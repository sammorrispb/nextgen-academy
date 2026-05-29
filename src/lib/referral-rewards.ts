import type Stripe from "stripe";
import { Resend } from "resend";
import { getStripe } from "@/lib/stripe";
import {
  findSubscriberByEmail,
  markReferralIssued,
} from "@/lib/notion-newsletter";
import {
  referralFriendRewardHtml,
  referralFriendRewardText,
} from "@/lib/email/referral-friend-reward";
import {
  referralReferrerRewardHtml,
  referralReferrerRewardText,
} from "@/lib/email/referral-referrer-reward";

const FROM_EMAIL = "Next Gen PB Academy <noreply@nextgenpbacademy.com>";
const REPLY_TO = "nextgenacademypb@gmail.com";
const ADMIN_BCC = "nextgenacademypb@gmail.com";

const PERCENT_OFF = 50;
const AMOUNT_OFF_LABEL = "50% off";

function firstName(full: string | null | undefined, fallback: string): string {
  return (full ?? "").split(/\s+/)[0] || fallback;
}

function metaString(meta: Stripe.Metadata | null, key: string): string {
  if (!meta) return "";
  return typeof meta[key] === "string" ? meta[key] : "";
}

/**
 * Mint a single-use percent-off coupon and a matching customer-facing
 * promotion code. We let Stripe auto-generate the code so we never collide
 * with an existing one. Coupon and promo code are both capped at 1
 * redemption — once it's used, it's gone.
 */
async function mintPromoCode(
  stripe: Stripe,
  label: string,
  metadata: Record<string, string>,
): Promise<{ code: string; couponId: string; promoId: string }> {
  const coupon = await stripe.coupons.create({
    percent_off: PERCENT_OFF,
    duration: "once",
    max_redemptions: 1,
    name: label,
    metadata,
  });
  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    max_redemptions: 1,
    metadata,
  });
  return { code: promo.code, couponId: coupon.id, promoId: promo.id };
}

/**
 * Inspect a paid Checkout Session for a referral payout. The friend's
 * newsletter row carries the referrer's email under `Referred By`; if it's
 * set and we haven't yet rewarded this friend, we mint two single-use
 * 50%-off promo codes (one each) and email both parents.
 *
 * Idempotency: `Referral Rewarded` on the friend's row gates a second run.
 * Stripe webhook retries hit the no-op branch.
 *
 * Failure mode: log + swallow. This runs inside the webhook's
 * Promise.allSettled fan-out — a Notion or Stripe blip here shouldn't bubble
 * up to the user's success page or Stripe's webhook retry logic.
 */
export async function processReferralReward(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Payment Links leave customer_email null — the payer email lands in
  // customer_details.email. Read both so referral payouts fire on discount-link
  // registrations too.
  const friendEmail =
    (session.customer_details?.email ?? session.customer_email)
      ?.trim()
      .toLowerCase() || "";
  if (!friendEmail) return;

  const friend = await findSubscriberByEmail(friendEmail);
  if (!friend) return;
  if (!friend.referredBy) return;
  if (friend.referralRewarded) return;

  const referrer = await findSubscriberByEmail(friend.referredBy);
  if (!referrer) {
    // The referral link decoded to an email that isn't in the subscribers
    // DB. Skip the payout but flip the flag so we don't retry on every
    // webhook hit. Common case: the original subscriber unsubscribed but
    // their forwards are still in the wild.
    console.warn(
      `[referral] referrer ${friend.referredBy} not in subscribers — skipping payout, marking friend ${friendEmail} rewarded`,
    );
    await markReferralIssued(friend.pageId, {
      flipRewarded: true,
      currentCount: friend.couponsIssued,
    });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[referral] RESEND_API_KEY missing — skipping payout emails");
    return;
  }
  const resend = new Resend(resendKey);
  const stripe = getStripe();

  const friendParentFirst = firstName(friend.parentName, "there");
  const friendChildFirst =
    metaString(session.metadata, "child_first_name") || "your player";
  const referrerFirst = firstName(referrer.parentName, "friend");

  // Mint both codes before sending either email — if Stripe rejects one we
  // bail without sending a half-completed payout.
  let friendCode: { code: string; couponId: string; promoId: string };
  let referrerCode: { code: string; couponId: string; promoId: string };
  try {
    friendCode = await mintPromoCode(
      stripe,
      `Referral ${PERCENT_OFF}% off — friend`,
      {
        referral: "friend",
        friend_email: friend.email,
        referrer_email: referrer.email,
      },
    );
    referrerCode = await mintPromoCode(
      stripe,
      `Referral ${PERCENT_OFF}% off — referrer`,
      {
        referral: "referrer",
        friend_email: friend.email,
        referrer_email: referrer.email,
      },
    );
  } catch (err) {
    console.error("[referral] Stripe coupon mint failed", err);
    return;
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nextgenpbacademy.com";
  const scheduleUrl = `${origin}/schedule`;

  const friendInput = {
    parentFirst: friendParentFirst,
    childFirst: friendChildFirst,
    referrerFirst,
    promoCode: friendCode.code,
    amountOffLabel: AMOUNT_OFF_LABEL,
    scheduleUrl,
  };
  const referrerInput = {
    parentFirst: firstName(referrer.parentName, "there"),
    friendFirst: friendParentFirst,
    friendChildFirst,
    promoCode: referrerCode.code,
    amountOffLabel: AMOUNT_OFF_LABEL,
    scheduleUrl,
  };

  const [friendRes, referrerRes] = await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: friend.email,
      bcc: ADMIN_BCC,
      replyTo: REPLY_TO,
      subject: `${AMOUNT_OFF_LABEL} off your next session — welcome to the crew`,
      html: referralFriendRewardHtml(friendInput),
      text: referralFriendRewardText(friendInput),
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: referrer.email,
      bcc: ADMIN_BCC,
      replyTo: REPLY_TO,
      subject: `${friendChildFirst} just played — ${AMOUNT_OFF_LABEL} off your next session`,
      html: referralReferrerRewardHtml(referrerInput),
      text: referralReferrerRewardText(referrerInput),
    }),
  ]);

  if (friendRes.error) {
    console.error("[referral] friend email failed", friendRes.error);
  }
  if (referrerRes.error) {
    console.error("[referral] referrer email failed", referrerRes.error);
  }

  // Flip the gate even if one email failed — the coupon's already minted in
  // Stripe and the parent can ask Sam to resend. Re-running this path would
  // mint a duplicate.
  await Promise.all([
    markReferralIssued(friend.pageId, {
      flipRewarded: true,
      currentCount: friend.couponsIssued,
    }),
    markReferralIssued(referrer.pageId, {
      flipRewarded: false,
      currentCount: referrer.couponsIssued,
    }),
  ]);
}

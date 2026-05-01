# FB Ad Lead Reply — Free Eval (Spring 2026)

**Trigger:** inbound lead with `utm_source=facebook` and `utm_campaign=free_eval_spring26` (or any paid_social FB/IG ad driving to `/free-evaluation`).

**Goal:** book the eval within 24h of the lead landing. Offer Rockville 4:30–6pm slots for the current week, capture the child's name, set expectations for the 30-min eval.

**Voice:** Coach Sam — warm, direct, no filler. Reference the ad creative where it feels natural ("glad the reel caught your eye").

**Recipients:**
- To: parent email
- CC: nextgenacademypb@gmail.com (always)

---

## Template

**Subject:** Next Gen Pickleball — Free Eval for Your {{childAge}}-Year-Old

Hi {{parentFirstName}},

Thanks for reaching out about Next Gen Pickleball Academy! Glad the {{creativeRef}} caught your eye.

I'd love to get your {{childAge}}-year-old on court for a free evaluation at our {{location}} location. Here are a few openings that work on my end:

- {{slotOption1}}
- {{slotOption2}}
- {{slotOption3}}

Which of those works best? I'll send a confirmation with exact time and court once we pick one.

Quick thing — what's your child's name? I want to make sure we greet them right when they show up.

The eval takes about 30 minutes. We'll run them through a few short drills to see where they fit in our ball-color system (Red, Orange, Green, Yellow), then talk through the right group to get them into.

Looking forward to meeting you both.

— Coach Sam
Next Gen Pickleball Academy
nextgenpbacademy.com

---

## Variable guide

| Variable | Source | Example |
|---|---|---|
| `parentFirstName` | `inbound_leads.first_name` | Sumaira |
| `childAge` | `extracted_data.child_age` | 7 |
| `location` | `extracted_data.location` | Rockville |
| `creativeRef` | `extracted_data.utm_content` → "reel" / "video" / "ad" | reel |
| `slotOption1-3` | 3 concrete slots pulled from Sam's court availability. Prefer weekend mornings + weekday afternoons before 5:30pm. Mix day-of-week so the parent has flexibility. | Sunday 4/19 at 11:00am · Monday 4/20 anytime before 5:30pm · Tuesday 4/21 between 4:30–5:30pm |

## Notes

- If lead lists North Bethesda preference, swap Rockville → North Bethesda and re-pick windows.
- If no phone on file and they reply with a time, confirm with court # and ask for a phone for same-day comms.
- First eval is always FREE (per Sam's rule — never quote re-eval pricing here).
- Log the reply and outcome in Open Brain; update Notion CRM status from `Lead` → `Eval Scheduled` once they confirm.

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

// GA4 + Meta Pixel, both ENV-GATED. Until NEXT_PUBLIC_GA4_MEASUREMENT_ID /
// NEXT_PUBLIC_META_PIXEL_ID are set, this component renders nothing and the
// site keeps running on its first-party /api/analytics pipeline alone.
//
// When the IDs exist:
//  - GA4 loads gtag.js and gets a config per page (SPA-safe: re-configured on
//    every pathname change).
//  - Meta Pixel loads fbevents.js and gets a PageView per pathname change.
//  - trackEvent() in @/lib/funnelClient mirrors conversion events to both
//    (see mirrorToThirdParty there).

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export default function Analytics() {
  const pathname = usePathname();

  // SPA pageviews: gtag's initial config only fires once, so re-send on route
  // change; Meta needs an explicit PageView per virtual page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (GA4_ID && typeof window.gtag === "function") {
        window.gtag("config", GA4_ID, { page_path: pathname });
      }
      if (META_PIXEL_ID && typeof window.fbq === "function") {
        window.fbq("track", "PageView");
      }
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname]);

  if (!GA4_ID && !META_PIXEL_ID) return null;

  return (
    <>
      {GA4_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="nga-ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA4_ID}', { page_path: window.location.pathname });
            `}
          </Script>
        </>
      )}
      {META_PIXEL_ID && (
        <Script id="nga-meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}

import api from "@/lib/api";

export type SiteVisitPageType = "HOME" | "LOGIN" | "REGISTER";

const getReferralCode = () => {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const refFromUrl = params.get("ref");
  if (refFromUrl) return refFromUrl.trim();

  const cookieMatch = document.cookie.match(/(?:^| )affiliate_ref=([^;]+)/);
  return cookieMatch ? decodeURIComponent(cookieMatch[1]).trim() : "";
};

export async function trackSiteVisit(pageType: SiteVisitPageType) {
  if (typeof window === "undefined") return;

  const referralCode = getReferralCode();
  const path = window.location.pathname || "/";
  const key = `talkion:site-visit:${pageType}:${path}:${referralCode || "direct"}`;

  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");

  try {
    await api.post("/site-visits/track", {
      pageType,
      path,
      fullUrl: window.location.href,
      referralCode: referralCode || undefined,
      referrerUrl: document.referrer || undefined,
      userAgent: navigator.userAgent,
      platform: navigator.platform || undefined,
      language: navigator.language || undefined,
      screenWidth: window.screen?.width || undefined,
      screenHeight: window.screen?.height || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    });
  } catch {
    sessionStorage.removeItem(key);
  }
}

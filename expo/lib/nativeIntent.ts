const STATIC_DESTINATIONS = new Set([
  "/",
  "/(tabs)",
  "/(tabs)/index",
  "/(tabs)/library",
  "/(tabs)/progress",
  "/settings",
  "/path",
  "/privacy",
  "/continue-from-web",
  "/entry",
  "/onboarding",
  "/paywall",
  "/purchase-success",
  "/custom",
  "/safety",
  "/progress/how-it-works",
]);

const DYNAMIC_DESTINATION = /^\/(?:scenario|rehearse|drill|debrief|module|interrupted|progress\/dimension)\/[A-Za-z0-9_-]+$/;
const WEB_HOSTS = new Set(["beforeyousayit.app", "www.beforeyousayit.app"]);
const APP_SCHEMES = new Set(["beforeyousayit:", "bysi:"]);

function pathFromInput(input: string): { pathname: string; search: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    try {
      if (decodeURIComponent(trimmed.split(/[?#]/u, 1)[0] ?? "").split("/").includes("..")) return null;
      const url = new URL(trimmed, "https://beforeyousayit.app");
      return { pathname: url.pathname, search: url.search };
    } catch {
      return null;
    }
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" && WEB_HOSTS.has(url.hostname.toLowerCase())) {
      return { pathname: url.pathname, search: url.search };
    }
    if (APP_SCHEMES.has(url.protocol)) {
      const hostSegment = url.hostname ? `/${url.hostname}` : "";
      return { pathname: `${hostSegment}${url.pathname}` || "/", search: url.search };
    }
  } catch {
    return null;
  }
  return null;
}

/** Allows only shipped user-facing destinations; malformed, foreign, and internal QA links fail closed. */
export function validatedNativeIntentPath(input: string): string {
  const parsed = pathFromInput(input);
  if (!parsed) return "/";
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname).replace(/\/+$/u, "") || "/";
  } catch {
    return "/";
  }
  if (pathname.includes("..") || (!STATIC_DESTINATIONS.has(pathname) && !DYNAMIC_DESTINATION.test(pathname))) return "/";
  return `${pathname}${parsed.search}`;
}

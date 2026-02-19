import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const isDev = process.env.NODE_ENV === "development";

let initialized = false;

export function initMixpanel() {
  if (initialized || !MIXPANEL_TOKEN) return;

  mixpanel.init(MIXPANEL_TOKEN, {
    debug: isDev,
    track_pageview: true,
    persistence: "localStorage",
  });

  initialized = true;
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.identify(userId);
  if (properties) {
    mixpanel.people.set(properties);
  }
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.track(event, properties);
}

export function reset() {
  if (!initialized) return;
  mixpanel.reset();
}

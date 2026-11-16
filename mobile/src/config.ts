// Public web host that serves shared idea/profile links and the legal pages.
// EXPO_PUBLIC_WEB_URL wins so a custom domain can be set without a code change.
export const WEB = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://vouch-api-9fpi.onrender.com').replace(/\/$/, '');

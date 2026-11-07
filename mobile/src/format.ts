export const inr = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN');
export const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n));
export const initials = (s: string) => (s || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

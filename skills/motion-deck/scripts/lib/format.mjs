// Small helpers shared by the scripts.
export const KB = (n) => `${Math.round(n / 1024)} KB`;
export const short = (s, n = 90) => (String(s).length > n ? String(s).slice(0, n - 3) + '...' : String(s));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

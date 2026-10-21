/** Local presentation mode, never a backend credential. */
export const DEMO_STORE_KEY = "binsoon-citizen-demo-v1";
export const DEMO_UPDATED = "binsoon-demo-updated";
export const DEMO_TOKEN = "binsoon-local-citizen";
export const DEMO_MODE_KEY = "binsoon-data-mode";
export const isDemoToken = (token?: string) => token === DEMO_TOKEN;
let memory: boolean | undefined;
export function setDemoMode(enabled: boolean) {
  memory = enabled;
  try {
    sessionStorage.setItem(DEMO_MODE_KEY, enabled ? "demo" : "backend");
  } catch {
    /* Storage may be unavailable. */
  }
}
export function useDemoData(token?: string) {
  if (token) return isDemoToken(token);
  try {
    const saved = sessionStorage.getItem(DEMO_MODE_KEY);
    return saved ? saved !== "backend" : (memory ?? true);
  } catch {
    return memory ?? true;
  }
}

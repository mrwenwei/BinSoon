export const DEFAULT_API_BASE =
  "https://binsoon-api-887203439341.asia-east1.run.app/api/v1";

export function apiBaseForHost(hostname: string, configured?: string): string {
  if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)) {
    return "/api/v1";
  }
  return (configured || DEFAULT_API_BASE).replace(/\/$/, "");
}

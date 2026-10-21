// A narrow desktop window is still desktop; this is a demo capability gate.
export function isPhoneBrowser() {
  return (
    /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent) &&
    navigator.maxTouchPoints > 0
  );
}

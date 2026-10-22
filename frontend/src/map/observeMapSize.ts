/** Avoid writing layout during ResizeObserver delivery (notably in WebKit). */
export function observeMapSize(element: HTMLElement, resize: () => void) {
  let width = -1;
  let height = -1;
  let frame = 0;
  const observer = new ResizeObserver(([entry]) => {
    const nextWidth = Math.round(entry.contentRect.width);
    const nextHeight = Math.round(entry.contentRect.height);
    if (
      !nextWidth ||
      !nextHeight ||
      (width === nextWidth && height === nextHeight)
    )
      return;
    width = nextWidth;
    height = nextHeight;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(resize);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}

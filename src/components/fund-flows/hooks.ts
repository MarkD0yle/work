import { useLayoutEffect, useState, type RefObject } from "react";

/** Content-box width of an element, tracked with ResizeObserver. */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback = 0) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

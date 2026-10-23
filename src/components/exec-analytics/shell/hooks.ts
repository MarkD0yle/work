import { useEffect, useState } from "react";

/** True for `ms` after mount: screens show shaped skeletons first, then content. */
export function useInitialLoad(ms = 500) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setLoading(false), ms); return () => window.clearTimeout(t); }, [ms]);
  return loading;
}

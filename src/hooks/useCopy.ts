import { useCallback, useEffect, useRef, useState } from "react";

/* useCopy — copy text to the clipboard and remember which thing was copied
 * for a moment, so the button that did it can say "Copied". */
export function useCopy(resetMs = 1800) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (key: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Clipboard API blocked (insecure context, permissions): fall back
        // to a hidden textarea and the legacy command.
        const area = document.createElement("textarea");
        area.value = value;
        area.setAttribute("readonly", "");
        area.className = "fixed -left-full top-0 opacity-0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopied(key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), resetMs);
    },
    [resetMs],
  );

  return { copied, copy };
}

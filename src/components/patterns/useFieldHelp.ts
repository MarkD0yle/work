import { useCallback, useState } from "react";

/* useFieldHelp — keeps a help panel in step with the field being edited.
 *
 * `bind(id)` returns the props to spread on a field; focusing it makes that
 * topic the active one. Help follows focus, not hover, so keyboard users get
 * it too and the panel doesn't flicker as the pointer crosses the form. The
 * last topic stays showing when focus leaves the form, so the user can still
 * read it. */

export function useFieldHelp() {
  const [active, setActive] = useState<string | null>(null);
  const bind = useCallback((id: string) => ({ onFocus: () => setActive(id) }), []);
  return { active, setActive, bind };
}

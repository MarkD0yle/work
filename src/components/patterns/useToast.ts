import { createContext, useContext } from "react";
import type { Tone } from "./tokens";

/* useToast — raise a toast from any component under ToastProvider. */

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: Tone;
  /** One action, usually Undo. Running it dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it goes. 0 keeps it until dismissed. Default 6000. */
  duration?: number;
};

export type ToastApi = {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

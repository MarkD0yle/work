import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Tip } from "./Overlay";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "tertiary" | "destructive";
  size?: "default" | "compact";
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "default", loading, icon, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className="ea-btn"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="ea-btn-spinner" aria-hidden />}
      <span className="ea-btn-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {icon}
        {children}
      </span>
    </button>
  );
});

type IconBtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  /** Overrides tooltip text (e.g. a disabled reason). Defaults to label. */
  tip?: string;
  size?: "default" | "sm";
  dot?: boolean;
  children: ReactNode;
};

/** Icon-only button. `label` is required: it is the aria-label and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { label, tip, size = "default", dot, children, type = "button", ...rest },
  ref,
) {
  return (
    <Tip label={tip ?? label}>
      <button ref={ref} type={type} className="ea-icon-btn" data-size={size} aria-label={label} {...rest}>
        {children}
        {dot && <span className="ea-dot" aria-hidden />}
      </button>
    </Tip>
  );
});

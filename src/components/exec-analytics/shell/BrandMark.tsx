import { BRAND_MARK_SRC } from "../config/brand";

/** Brand slot: neutral 24px square until a `src` is supplied via config/brand.ts. */
export function BrandMark({ src = BRAND_MARK_SRC }: { src?: string }) {
  return src
    ? <img src={src} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: "contain" }} />
    : <span aria-hidden style={{ width: 24, height: 24, background: "var(--color-border)", display: "inline-block", flex: "none" }} />;
}

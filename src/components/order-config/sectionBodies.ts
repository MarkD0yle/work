import type { ReactElement } from "react";
import { BasicInfoBody, CreationBody, RedemptionBody } from "./FormSections";
import type { Errors, OrderConfig, SectionId } from "./model";

export const SECTION_BODIES: Record<
  SectionId,
  (props: {
    value: OrderConfig;
    errors: Errors;
    onChange: (patch: Partial<OrderConfig>) => void;
  }) => ReactElement
> = {
  basic: BasicInfoBody,
  creation: CreationBody,
  redemption: RedemptionBody,
};

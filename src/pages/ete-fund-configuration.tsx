import FundConnect2Page from "../features/fund-connect-2";

export const title = "ETE Fund Configuration";
export const section = "forms";
export const fullWidth = true;

/* Route stub — ETE Fund Configuration is a workspace of Fund Connect 2
 * (src/features/fund-connect-2/ete). This page opens Fund Connect 2 straight
 * on it, so the pattern has its own card and sidebar entry; the same
 * workspace is one click away from the register inside Fund Connect 2. */
export default function EteFundConfigurationPage() {
  return <FundConnect2Page initialArea="configuration" />;
}

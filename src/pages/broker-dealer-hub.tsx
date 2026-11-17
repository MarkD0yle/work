import { EmptyState, PageHeader } from "../components/patterns";

export const title = "Broker-Dealer Hub";

/* Broker-Dealer Hub — placeholder for a single-screen prototype. Content to be defined. */
export default function BrokerDealerHub() {
  return (
    <div className="flex flex-col">
      <PageHeader eyebrow="Broker-Dealer" title="Broker-Dealer Hub" />
      <EmptyState kind="first" title="Nothing here yet" description="This screen is a placeholder." />
    </div>
  );
}

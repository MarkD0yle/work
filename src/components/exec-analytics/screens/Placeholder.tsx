import { EmptyState } from "../ui";

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="ea-page">
      <h1 className="ea-title">{title}</h1>
      <EmptyState title="Not part of this phase" hint="This route exists in the navigation but its screen is out of scope for the current build." />
    </div>
  );
}

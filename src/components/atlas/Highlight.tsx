/* Highlight — emphasise the matched portion of a string, case-insensitively.
 * Shared by every Atlas view so search feedback looks the same everywhere. */

type Props = {
  text: string;
  query: string;
};

export default function Highlight({ text, query }: Props) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/80 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

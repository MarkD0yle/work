import { motion } from "framer-motion";

/* A small live indicator signalling "AI is actively looking at this section"
 * — pulses while there's something to flag, sits still (and green) once
 * clear. Purely presentational; the actual analysis is the deterministic
 * suggestNextSteps() engine, same as everywhere else in this app. */
export function AIPulseDot({ active }: { active: boolean }) {
  if (!active) {
    return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />;
  }
  return (
    <motion.span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
      animate={{ opacity: [1, 0.35, 1], scale: [1, 1.35, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

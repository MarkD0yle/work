/* Password strength — a deliberately simple, transparent heuristic (length +
 * character classes). Returns a 0–4 score with a label and the unmet checks,
 * so the UI can both rate the password and tell the user what's missing. */
export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { id: string; label: string; met: boolean }[];
};

export function scorePassword(pw: string): PasswordStrength {
  const checks = [
    { id: "len", label: "At least 8 characters", met: pw.length >= 8 },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(pw) },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(pw) },
    { id: "num", label: "A number", met: /\d/.test(pw) },
    { id: "sym", label: "A symbol", met: /[^A-Za-z0-9]/.test(pw) },
  ];
  const met = checks.filter((c) => c.met).length;
  // Map the 5 checks down to a 0–4 score.
  const score = (pw.length === 0 ? 0 : Math.min(4, Math.max(1, met - 1))) as
    | 0
    | 1
    | 2
    | 3
    | 4;
  const label = ["", "Weak", "Fair", "Good", "Strong"][score];
  return { score, label, checks };
}

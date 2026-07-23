/* Circular progress gauge — e.g. "5/8 sections ready" as a percentage ring,
 * same visual idea as the reference's "Intelligence Readiness" gauge. */
export function ReadinessGauge({ value }: { value: number }) {
  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), 100);
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 75 ? "#10b981" : clamped >= 40 ? "#f59e0b" : "#a3a3a3";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e5e5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-semibold text-neutral-900">{Math.round(clamped)}</span>
        <span className="text-[9px] text-neutral-400">/ 100</span>
      </div>
    </div>
  );
}

/** 自前 SVG の諸島マップ。点は場所。計画の場所は山吹の輪、そこにいる人のアバターを添える。 */
import type { MapItem } from "../pages/Plan";

export function IslandMap({ items, onPick, compact }: { items: MapItem[]; onPick?: (id: number) => void; compact?: boolean }) {
  const h = compact ? 230 : 280;
  return (
    <svg viewBox={`0 0 400 ${h}`} className="art" role="img" aria-label="星凪諸島の地図" style={{ background: "var(--ai-050)", border: "1px solid var(--ai-100)" }}>
      <defs>
        <clipPath id="c-av"><circle r="13" /></clipPath>
      </defs>
      <g fill="#e9ecf2" stroke="var(--ai-300)" strokeWidth="1">
        <path d="M40 40 q40 -30 90 0 q20 40 -10 70 q-40 20 -80 0 q-20 -40 0 -70z" />
        <path d="M250 40 q50 -20 100 10 q20 40 -20 60 q-50 20 -90 -10 q-10 -30 10 -60z" />
        <path d="M70 160 q80 -60 180 -20 q90 20 100 90 q-40 40 -140 40 q-120 0 -150 -50 q-10 -40 10 -60z" transform={compact ? "translate(0 -30) scale(1 0.85)" : undefined} />
      </g>
      <text x="200" y="18" textAnchor="middle" fontSize="11" fill="var(--ai-700)" fontFamily="var(--font-head)" letterSpacing="2">星凪諸島</text>
      {items.map((s) => {
        const y = compact ? s.map_y * 0.8 : s.map_y;
        return (
          <g key={s.id} transform={`translate(${s.map_x} ${y})`} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(s.id)} role={onPick ? "button" : undefined} aria-label={s.name}>
            {s.in_plan && <circle r="22" fill="none" stroke="var(--yamabuki)" strokeWidth="2.5" />}
            <circle r="5" fill="var(--ai-900)" stroke="#fff" strokeWidth="1.5" />
            {s.people.slice(0, 2).map((p, i) => (
              <g key={p.id} transform={`translate(${12 + i * 22} -16)`} opacity={p.status === "open" || p.status === "closing_soon" || p.met_today ? 1 : 0.45}>
                <circle r="14" fill="#fff" stroke={p.met_today ? "var(--yamabuki)" : "var(--ai-300)"} strokeWidth={p.met_today ? 2 : 1} />
                <image href={p.image} x="-13" y="-13" width="26" height="26" clipPath="url(#c-av)" preserveAspectRatio="xMidYMin slice" />
              </g>
            ))}
            <text y="20" textAnchor="middle" fontSize="10" fill="var(--ai-900)" fontWeight="700">{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

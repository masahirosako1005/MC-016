/** 自前 SVG の諸島マップ。スポットをタップで開く。 */
import { navigate } from "../router";

export type MapSpot = { id: number; name: string; area: string; map_x: number; map_y: number; svg_key: string };

export function IslandMap({ spots, highlight }: { spots: MapSpot[]; highlight?: Set<number> }) {
  return (
    <svg viewBox="0 0 400 280" className="art" role="img" aria-label="星凪諸島の地図" style={{ background: "#cfe3ec", borderRadius: 14 }}>
      {/* 島 */}
      <path d="M40 40 q40 -30 90 0 q20 40 -10 70 q-40 20 -80 0 q-20 -40 0 -70z" fill="#b9c99a" stroke="#8fa073" />
      <path d="M250 40 q50 -20 100 10 q20 40 -20 60 q-50 20 -90 -10 q-10 -30 10 -60z" fill="#b9c99a" stroke="#8fa073" />
      <path d="M70 160 q80 -60 180 -20 q90 20 100 90 q-40 40 -140 40 q-120 0 -150 -50 q-10 -40 10 -60z" fill="#c8d6a6" stroke="#8fa073" />
      <text x="200" y="20" textAnchor="middle" fontSize="12" fill="#2f5d62" fontWeight="700">星凪諸島</text>
      {spots.map((s) => {
        const hi = highlight?.has(s.id);
        return (
          <g key={s.id} transform={`translate(${s.map_x} ${s.map_y})`} style={{ cursor: "pointer" }} onClick={() => navigate(`/place/spot/${s.id}`)} role="link" aria-label={s.name}>
            <circle r="16" fill={hi ? "#c9527a" : "#2f5d62"} opacity=".15" />
            <circle r="7" fill={hi ? "#c9527a" : "#2f5d62"} stroke="#fff" strokeWidth="2" />
            <text y="22" textAnchor="middle" fontSize="10" fill="#27323a" fontWeight="700">{s.name.replace(/（.*/, "")}</text>
          </g>
        );
      })}
    </svg>
  );
}

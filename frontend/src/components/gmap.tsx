/** 星凪諸島の地図。背景は自作の地形図（img/map/hoshinagi_map.png、2560×1920、文字なし）。地区名・場所名・ピン・人・現在地は自前 SVG で重ねる。外部タイルは使わない。 */
import type { ReactNode } from "react";

export type GPin = {
  id: number; name: string; x: number; y: number;
  state: "plan" | "visited" | "normal" | "off"; order?: number;
  people?: { id: number; image: string; dim?: boolean }[];
};

const AI = "#1b2a44";
const YAMA = "#e3a21a";

/** 地区名の置き場所（viewBox 400×300）。島の形に合わせて手で決めた。 */
const AREAS: { name: string; x: number; y: number; anchor?: "start" | "middle" | "end"; small?: boolean }[] = [
  { name: "白波離島", x: 68, y: 76 },
  { name: "薄青岬", x: 352, y: 108 },
  { name: "鈴風高原", x: 122, y: 128, anchor: "end" },
  { name: "虹帆町", x: 196, y: 180 },
  { name: "雫森谷", x: 72, y: 210, anchor: "end" },
  { name: "月灯集落", x: 292, y: 182 },
  { name: "星綴港", x: 215, y: 254 },
  { name: "星凪の海", x: 330, y: 272, small: true },
];

export function GMap({
  pins, me, onPick, height = 300, children, selectable,
}: { pins: GPin[]; me?: { x: number; y: number; label?: string } | null; onPick?: (id: number) => void; height?: number; children?: ReactNode; selectable?: boolean }) {
  return (
    <svg viewBox="0 0 400 300" className="gmap" style={{ maxHeight: height }} role="img" aria-label="星凪諸島の地図">
      <defs>
        <clipPath id="g-av"><circle r="11" /></clipPath>
        <filter id="g-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity=".4" /></filter>
      </defs>
      <image href="/img/map/hoshinagi_map.png" x="0" y="0" width="400" height="300" preserveAspectRatio="xMidYMid slice" />
      {AREAS.map((a) => (
        <text key={a.name} x={a.x} y={a.y} textAnchor={a.anchor ?? "middle"} fontSize={a.small ? 7 : 8.5} fontFamily="'Yu Mincho', 'Hiragino Mincho ProN', serif" fontWeight="700" fill={a.small ? "#2f5d7a" : "#2f446a"} letterSpacing={a.small ? 2 : 1} stroke="#fff" strokeWidth="2.5" paintOrder="stroke" opacity={a.small ? 0.8 : 0.95} style={{ pointerEvents: "none" }}>{a.name}</text>
      ))}
      {children}
      {[...pins].sort((a, b) => (a.state === "plan" ? 1 : 0) - (b.state === "plan" ? 1 : 0)).map((p) => (
        <Pin key={p.id} p={p} onPick={onPick} selectable={selectable} />
      ))}
      {me && (
        <g transform={`translate(${me.x} ${me.y})`}>
          <circle r="11" fill="#4a90e2" opacity=".25" />
          <circle r="6.5" fill="#4a90e2" stroke="#fff" strokeWidth="2.5" filter="url(#g-shadow)" />
          <text y="22" textAnchor="middle" fontSize="8.5" fill="#2a63a8" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">{me.label ?? "現在地"}</text>
        </g>
      )}
    </svg>
  );
}

function Pin({ p, onPick, selectable }: { p: GPin; onPick?: (id: number) => void; selectable?: boolean }) {
  const plan = p.state === "plan";
  const visited = p.state === "visited";
  const off = p.state === "off";
  const color = plan ? YAMA : visited ? AI : off ? "#c7ccd6" : "#ffffff";
  const scale = plan ? 1.2 : 0.95;
  return (
    <g transform={`translate(${p.x} ${p.y})`} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(p.id)} role={onPick ? "button" : undefined} aria-label={p.name} opacity={off ? 0.85 : 1}>
      <g transform={`scale(${scale})`} filter="url(#g-shadow)">
        <path d="M0 0 c-7 -9 -11 -14 -11 -20 a11 11 0 1 1 22 0 c0 6 -4 11 -11 20z" fill={color} stroke={plan || visited ? "#fff" : AI} strokeWidth="1.5" />
        {plan && p.order !== undefined && <text y="-16" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="800">{p.order}</text>}
        {visited && <path d="M-5 -21 l3.5 3.5 l7 -7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {!plan && !visited && <circle cy="-20" r="4" fill={AI} />}
      </g>
      {p.people?.slice(0, 2).map((q, i) => (
        <g key={q.id} transform={`translate(${16 + i * 20} -30)`} opacity={q.dim ? 0.55 : 1}>
          <circle r="12" fill="#fff" stroke={plan ? YAMA : AI} strokeWidth="1.5" filter="url(#g-shadow)" />
          <image href={q.image} x="-11" y="-11" width="22" height="22" clipPath="url(#g-av)" preserveAspectRatio="xMidYMin slice" />
        </g>
      ))}
      <text y="11" textAnchor="middle" fontSize="7.5" fill={plan ? "#7a5300" : AI} fontWeight="700" stroke="#fff" strokeWidth="2.5" paintOrder="stroke" style={{ pointerEvents: "none" }}>{p.name}</text>
      {selectable && (
        <text y="21" textAnchor="middle" fontSize="7" fill={plan ? "#7a5300" : "#56698f"} fontWeight="700" stroke="#fff" strokeWidth="2.5" paintOrder="stroke" style={{ pointerEvents: "none" }}>{plan ? "行く（タップで外す）" : "タップで行きたいに"}</text>
      )}
    </g>
  );
}

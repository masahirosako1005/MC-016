/** 星凪諸島の地図。背景は島々の空撮写真（Unsplash、ローカル配信）。その上に航路・ピン・地名・現在地を自前 SVG で描く。外部タイルは使わない。 */
import type { ReactNode } from "react";

export type GPin = {
  id: number; name: string; x: number; y: number;
  state: "plan" | "visited" | "normal" | "off"; order?: number;
  people?: { id: number; image: string; dim?: boolean }[];
};

const AI = "#1b2a44";
const YAMA = "#e3a21a";
const PORT = { x: 217, y: 258 };

export function GMap({
  pins, me, onPick, height = 300, children, selectable,
}: { pins: GPin[]; me?: { x: number; y: number; label?: string } | null; onPick?: (id: number) => void; height?: number; children?: ReactNode; selectable?: boolean }) {
  return (
    <svg viewBox="0 0 400 300" className="gmap" style={{ maxHeight: height }} role="img" aria-label="星凪諸島の地図">
      <defs>
        <clipPath id="g-av"><circle r="11" /></clipPath>
        <filter id="g-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity=".45" /></filter>
        <linearGradient id="g-vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b2a44" stopOpacity=".18" /><stop offset=".5" stopColor="#1b2a44" stopOpacity="0" /><stop offset="1" stopColor="#1b2a44" stopOpacity=".28" /></linearGradient>
      </defs>
      <image href="/img/map/island.jpg" x="0" y="0" width="400" height="300" preserveAspectRatio="xMidYMid slice" />
      <rect width="400" height="300" fill="url(#g-vig)" />
      {/* 航路（港から） */}
      {pins.filter((p) => !(p.x === PORT.x && p.y === PORT.y)).map((p) => (
        <path key={`r${p.id}`} d={`M${PORT.x} ${PORT.y} Q${(PORT.x + p.x) / 2 + 10} ${(PORT.y + p.y) / 2 - 20} ${p.x} ${p.y}`} stroke="#ffffff" strokeWidth="1" strokeDasharray="3 4" fill="none" opacity=".55" />
      ))}
      <text x="200" y="16" fontSize="10" fill="#ffffff" fontFamily="var(--font-head)" letterSpacing="3" textAnchor="middle" opacity=".9" stroke="#1b2a44" strokeWidth="2" paintOrder="stroke">星凪諸島</text>
      <text x="8" y="292" fontSize="7" fill="#ffffff" opacity=".8">空撮: Unsplash（ローカル配信）</text>
      {children}
      {[...pins].sort((a, b) => (a.state === "plan" ? 1 : 0) - (b.state === "plan" ? 1 : 0)).map((p) => (
        <Pin key={p.id} p={p} onPick={onPick} selectable={selectable} />
      ))}
      {me && (
        <g transform={`translate(${me.x} ${me.y})`}>
          <circle r="12" fill="#4a90e2" opacity=".25" />
          <circle r="7" fill="#4a90e2" stroke="#fff" strokeWidth="2.5" filter="url(#g-shadow)" />
          <text y="26" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="700" stroke="#1b2a44" strokeWidth="3" paintOrder="stroke">{me.label ?? "現在地"}</text>
        </g>
      )}
    </svg>
  );
}

function Pin({ p, onPick, selectable }: { p: GPin; onPick?: (id: number) => void; selectable?: boolean }) {
  const plan = p.state === "plan";
  const visited = p.state === "visited";
  const off = p.state === "off";
  const color = plan ? YAMA : visited ? AI : off ? "#c7ccd6" : "#f3f4f7";
  const scale = plan ? 1.25 : 1;
  return (
    <g transform={`translate(${p.x} ${p.y})`} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(p.id)} role={onPick ? "button" : undefined} aria-label={p.name} opacity={off ? 0.8 : 1}>
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
      <text y={plan ? 14 : 12} textAnchor="middle" fontSize={plan ? 11 : 10} fill="#ffffff" fontWeight={plan ? 800 : 700} stroke="#1b2a44" strokeWidth="3.5" paintOrder="stroke">{p.name}</text>
      {selectable && (
        <text y={plan ? 26 : 24} textAnchor="middle" fontSize="8" fill={plan ? "#ffe9b0" : "#ffffff"} stroke="#1b2a44" strokeWidth="3" paintOrder="stroke">{plan ? "行く（タップで外す）" : "タップで行きたいに"}</text>
      )}
    </g>
  );
}

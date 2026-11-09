/** 星凪諸島の地図（自前 SVG）。地図アプリ風の配色: 海・陸・緑地・砂浜・道路・地名ラベル・ピン・現在地。外部タイルは使わない。 */
import type { ReactNode } from "react";

export type GPin = {
  id: number; name: string; x: number; y: number;
  state: "plan" | "visited" | "normal" | "off"; order?: number;
  people?: { id: number; image: string; dim?: boolean }[];
};

const SEA = "#a8d4f5";
const SEA_DEEP = "#8ec3ee";
const LAND = "#f3f0ea";
const GREEN = "#cfe8c6";
const SAND = "#f7eecf";
const ROAD = "#ffffff";
const ROAD_EDGE = "#dcd9d2";
const MAIN_ROAD = "#fde9a9";
const MAIN_EDGE = "#e9c96a";
const LABEL = "#3a3a3a";
const WATER_LABEL = "#4a7fb5";
const AI = "#1b2a44";
const YAMA = "#e3a21a";

export function GMap({
  pins, me, onPick, height = 300, children, selectable,
}: { pins: GPin[]; me?: { x: number; y: number; label?: string } | null; onPick?: (id: number) => void; height?: number; children?: ReactNode; selectable?: boolean }) {
  return (
    <svg viewBox="0 0 400 300" className="gmap" style={{ maxHeight: height }} role="img" aria-label="星凪諸島の地図">
      <defs>
        <clipPath id="g-av"><circle r="11" /></clipPath>
        <filter id="g-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity=".35" /></filter>
        <pattern id="g-sea" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={SEA} />
          <path d="M0 20 q10 -6 20 0 t20 0" stroke={SEA_DEEP} strokeWidth="1" fill="none" opacity=".5" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill="url(#g-sea)" />
      {/* 白波離島（北西） */}
      <g>
        <path d="M30 42 q38 -34 92 -6 q24 36 -4 68 q-44 26 -86 2 q-24 -36 -2 -64z" fill={SAND} />
        <path d="M38 46 q34 -28 80 -4 q20 30 -4 58 q-38 22 -76 0 q-20 -30 0 -54z" fill={LAND} />
        <path d="M52 60 q24 -12 48 2 q6 18 -10 30 q-26 10 -42 -6 q-6 -14 4 -26z" fill={GREEN} />
        <path d="M40 90 q30 -10 70 -30" stroke={ROAD_EDGE} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M40 90 q30 -10 70 -30" stroke={ROAD} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      {/* 薄青岬（北東） */}
      <g>
        <path d="M250 36 q54 -24 108 12 q22 40 -22 62 q-56 22 -96 -12 q-14 -32 10 -62z" fill={SAND} />
        <path d="M258 42 q48 -20 96 10 q18 34 -20 54 q-50 18 -86 -10 q-12 -28 10 -54z" fill={LAND} />
        <path d="M280 56 q30 -12 56 6 q4 16 -14 24 q-28 8 -44 -6 q-6 -12 2 -24z" fill={GREEN} />
        <path d="M262 96 q40 -30 90 -20" stroke={ROAD_EDGE} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M262 96 q40 -30 90 -20" stroke={ROAD} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      {/* 本島（南） */}
      <g>
        <path d="M60 170 q90 -70 200 -24 q100 24 112 104 q-44 48 -156 46 q-134 2 -168 -56 q-14 -46 12 -70z" fill={SAND} />
        <path d="M68 174 q86 -64 190 -22 q94 22 104 96 q-40 44 -148 42 q-126 2 -158 -52 q-12 -42 12 -64z" fill={LAND} />
        <path d="M80 200 q40 -30 90 -10 q8 26 -20 40 q-46 14 -70 -4 q-8 -14 0 -26z" fill={GREEN} />
        <path d="M250 150 q40 -14 76 8 q12 28 -18 38 q-40 10 -60 -10 q-8 -22 2 -36z" fill={GREEN} />
        <ellipse cx="112" cy="206" rx="28" ry="16" fill={SEA} />
        <ellipse cx="112" cy="206" rx="22" ry="11" fill={SEA_DEEP} opacity=".5" />
        {/* 幹線 */}
        <path d="M70 240 q70 20 140 0 t120 -30" stroke={MAIN_EDGE} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M70 240 q70 20 140 0 t120 -30" stroke={MAIN_ROAD} strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* 脇道 */}
        {["M210 240 q-6 -40 -10 -90", "M210 240 q50 -20 120 -40", "M140 210 q-10 -20 -30 -30", "M300 210 q20 -20 30 -40", "M70 240 q-6 -40 -10 -120"].map((d) => (
          <g key={d}>
            <path d={d} stroke={ROAD_EDGE} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d={d} stroke={ROAD} strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        ))}
        {/* 建物 */}
        {[[196, 232], [206, 226], [216, 234], [226, 228], [236, 236], [182, 150], [290, 212], [328, 206]].map(([x, y]) => (
          <rect key={`${x}${y}`} x={x} y={y} width="7" height="6" fill="#e2dcd2" stroke="#cfc8bb" strokeWidth=".6" />
        ))}
      </g>
      {/* 航路 */}
      <path d="M210 240 q-70 -90 -130 -160" stroke="#6ea8dd" strokeWidth="1.4" strokeDasharray="4 4" fill="none" />
      <path d="M210 240 q60 -90 100 -150" stroke="#6ea8dd" strokeWidth="1.4" strokeDasharray="4 4" fill="none" />
      {/* 水域ラベル */}
      <text x="200" y="22" fontSize="10" fill={WATER_LABEL} fontStyle="italic" textAnchor="middle">星凪の海</text>
      <text x="40" y="285" fontSize="9" fill={WATER_LABEL} fontStyle="italic">凪の入り江</text>
      {children}
      {/* ピン（薄い順に描いて、計画のピンを前に） */}
      {[...pins].sort((a, b) => (a.state === "plan" ? 1 : 0) - (b.state === "plan" ? 1 : 0)).map((p) => (
        <Pin key={p.id} p={p} onPick={onPick} selectable={selectable} />
      ))}
      {me && (
        <g transform={`translate(${me.x} ${me.y})`}>
          <circle r="16" fill="#4a90e2" opacity=".25" className="pulse" />
          <circle r="7" fill="#4a90e2" stroke="#fff" strokeWidth="2.5" filter="url(#g-shadow)" />
          <text y="26" textAnchor="middle" fontSize="9" fill="#2a63a8" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">{me.label ?? "現在地"}</text>
        </g>
      )}
    </svg>
  );
}

function Pin({ p, onPick, selectable }: { p: GPin; onPick?: (id: number) => void; selectable?: boolean }) {
  const plan = p.state === "plan";
  const visited = p.state === "visited";
  const off = p.state === "off";
  const color = plan ? YAMA : visited ? AI : off ? "#b9bec7" : "#8d96a6";
  const scale = plan ? 1.25 : 1;
  return (
    <g transform={`translate(${p.x} ${p.y})`} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(p.id)} role={onPick ? "button" : undefined} aria-label={p.name} opacity={off ? 0.75 : 1}>
      <g transform={`scale(${scale})`} filter="url(#g-shadow)">
        <path d="M0 0 c-7 -9 -11 -14 -11 -20 a11 11 0 1 1 22 0 c0 6 -4 11 -11 20z" fill={color} stroke="#fff" strokeWidth="1.5" />
        {plan && p.order !== undefined && <text y="-16" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="800">{p.order}</text>}
        {visited && <path d="M-5 -21 l3.5 3.5 l7 -7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {!plan && !visited && <circle cy="-20" r="4" fill="#fff" />}
      </g>
      {p.people?.slice(0, 2).map((q, i) => (
        <g key={q.id} transform={`translate(${16 + i * 20} -30)`} opacity={q.dim ? 0.5 : 1}>
          <circle r="12" fill="#fff" stroke={color} strokeWidth="1.5" filter="url(#g-shadow)" />
          <image href={q.image} x="-11" y="-11" width="22" height="22" clipPath="url(#g-av)" preserveAspectRatio="xMidYMin slice" />
        </g>
      ))}
      <text y={plan ? 14 : 12} textAnchor="middle" fontSize={plan ? 11 : 10} fill={off ? "#8d96a6" : LABEL} fontWeight={plan ? 800 : 600} stroke="#fff" strokeWidth="3.5" paintOrder="stroke">{p.name}</text>
      {selectable && (
        <text y={plan ? 26 : 24} textAnchor="middle" fontSize="8" fill={plan ? "#8a6200" : "#6b7680"} stroke="#fff" strokeWidth="3" paintOrder="stroke">{plan ? "行く（タップで外す）" : "タップで行きたいに"}</text>
      )}
    </g>
  );
}

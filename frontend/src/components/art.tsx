/** 自前 SVG。スポット・店の風景と、お店の人のキャラクター。外部画像は使わない。 */
import type { CSSProperties } from "react";

type Props = { className?: string; style?: CSSProperties };

const SKY = "#dbeaf3";
const SEA = "#7fb3c8";
const LAND = "#b9c99a";

function Frame({ children, className, style, bg = SKY }: Props & { children: React.ReactNode; bg?: string }) {
  return (
    <svg viewBox="0 0 320 180" className={className ?? "art"} style={style} role="img" aria-hidden="true">
      <rect width="320" height="180" fill={bg} />
      {children}
    </svg>
  );
}

export function SceneArt({ k, season, ...p }: Props & { k: string; season?: string }) {
  const tint = season === "winter" ? "#eef3f7" : season === "spring" ? "#f7ecef" : season === "summer" ? "#e3f1f7" : "#f6ecdd";
  switch (k) {
    case "lighthouse":
      return (
        <Frame {...p} bg={tint}>
          <rect y="110" width="320" height="70" fill={SEA} />
          <ellipse cx="160" cy="118" rx="120" ry="18" fill={LAND} />
          <rect x="148" y="40" width="24" height="78" fill="#fff" stroke="#8a97a3" />
          <rect x="148" y="60" width="24" height="10" fill="#d9534f" />
          <rect x="148" y="85" width="24" height="10" fill="#d9534f" />
          <polygon points="144,40 176,40 160,26" fill="#5b6770" />
          <circle cx="160" cy="36" r="5" fill="#ffd166" />
          <path d="M20 60 q20 -10 40 0 t40 0" stroke="#fff" strokeWidth="3" fill="none" opacity=".8" />
        </Frame>
      );
    case "cape":
      return (
        <Frame {...p} bg="#1e2a44">
          <rect y="100" width="320" height="80" fill="#2b4f6e" />
          {[30, 70, 120, 200, 250, 290, 160, 90].map((x, i) => (
            <circle key={i} cx={x} cy={20 + ((i * 37) % 60)} r={1.6 + (i % 3) * 0.6} fill="#fff" />
          ))}
          <path d="M0 120 L120 95 L200 110 L320 100 L320 180 L0 180Z" fill="#3b3a36" />
          <polygon points="150,112 160,92 170,112 190,116 174,126 178,146 160,136 142,146 146,126 130,116" fill="#f0d98a" />
        </Frame>
      );
    case "market":
      return (
        <Frame {...p} bg="#2d2a3a">
          <rect y="130" width="320" height="50" fill="#4a4556" />
          <path d="M0 40 Q160 70 320 40" stroke="#c9c2d6" strokeWidth="2" fill="none" />
          {["#ff8a65", "#ffd54f", "#81c784", "#64b5f6", "#ba68c8", "#f06292", "#4dd0e1"].map((c, i) => (
            <g key={c}>
              <rect x={20 + i * 42} y={50 + (i % 2) * 6} width="22" height="26" rx="6" fill={c} />
              <circle cx={31 + i * 42} cy={63 + (i % 2) * 6} r="6" fill="#fff8" />
            </g>
          ))}
          {[40, 120, 200, 270].map((x) => (
            <rect key={x} x={x} y="100" width="48" height="30" fill="#8d6e63" />
          ))}
        </Frame>
      );
    case "lake":
      return (
        <Frame {...p} bg={tint}>
          <path d="M0 90 L70 50 L120 80 L190 40 L260 85 L320 60 L320 180 L0 180Z" fill="#7d9b76" />
          <ellipse cx="160" cy="140" rx="140" ry="32" fill={SEA} />
          <ellipse cx="160" cy="140" rx="120" ry="20" fill="#a9d1de" opacity=".7" />
          <circle cx="60" cy="70" r="12" fill="#d9775b" />
          <circle cx="250" cy="78" r="10" fill="#e3a14d" />
        </Frame>
      );
    case "windmill":
      return (
        <Frame {...p} bg={tint}>
          <path d="M0 180 Q160 90 320 180Z" fill="#9fc07a" />
          {[90, 160, 230].map((x, i) => (
            <g key={x} transform={`translate(${x} ${120 - i * 6})`}>
              <polygon points="-8,0 8,0 5,-50 -5,-50" fill="#f2e9d8" stroke="#8a7f6a" />
              <g stroke="#8a7f6a" strokeWidth="3">
                <line x1="0" y1="-50" x2="0" y2="-80" />
                <line x1="0" y1="-50" x2="0" y2="-20" />
                <line x1="0" y1="-50" x2="30" y2="-50" />
                <line x1="0" y1="-50" x2="-30" y2="-50" />
              </g>
            </g>
          ))}
          {[20, 60, 110, 180, 260, 300].map((x) => (
            <circle key={x} cx={x} cy={165} r="5" fill="#ffd54f" />
          ))}
        </Frame>
      );
    case "street":
      return (
        <Frame {...p} bg="#f1d6b8">
          <rect y="0" width="320" height="60" fill="#e8c7a8" />
          <path d="M120 180 L140 60 L180 60 L200 180Z" fill="#a8a29e" />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={122 + i * 4} y1={180 - i * 24} x2={198 - i * 4} y2={180 - i * 24} stroke="#7d746d" />
          ))}
          <rect x="30" y="70" width="90" height="110" fill="#8d6e63" />
          <rect x="200" y="70" width="90" height="110" fill="#6d4c41" />
          {[50, 85, 220, 255].map((x) => (
            <rect key={x} x={x} y="95" width="18" height="22" fill="#ffd166" />
          ))}
        </Frame>
      );
    case "hall":
      return (
        <Frame {...p} bg="#e9f0f6">
          <rect y="120" width="320" height="60" fill="#f7f9fb" />
          <polygon points="160,30 60,90 260,90" fill="#6d4c41" />
          <rect x="80" y="90" width="160" height="60" fill="#8d6e63" />
          {[100, 140, 180, 220].map((x) => (
            <rect key={x} x={x} y="105" width="18" height="28" fill="#ffd166" />
          ))}
          {[20, 50, 280, 300, 40, 270].map((x, i) => (
            <circle key={i} cx={x} cy={40 + i * 10} r="2" fill="#fff" />
          ))}
        </Frame>
      );
    case "stand":
      return (
        <Frame {...p} bg={tint}>
          <rect y="140" width="320" height="40" fill={LAND} />
          <rect x="110" y="70" width="100" height="70" fill="#f2e9d8" stroke="#8a7f6a" />
          <polygon points="100,70 220,70 210,50 110,50" fill="#d9534f" />
          <rect x="130" y="90" width="60" height="30" fill="#9fc0d9" />
          <rect x="150" y="120" width="20" height="16" fill="#5b6770" />
        </Frame>
      );
    case "diner":
      return (
        <Frame {...p} bg="#2d2a3a">
          <rect y="130" width="320" height="50" fill="#4a4556" />
          <rect x="90" y="60" width="140" height="70" fill="#5d4037" />
          <rect x="90" y="50" width="140" height="14" fill="#1b4965" />
          <text x="160" y="62" fill="#fff" fontSize="10" textAnchor="middle">虹のかけら</text>
          {[110, 150, 190].map((x) => (
            <rect key={x} x={x} y="80" width="24" height="30" fill="#ffd166" />
          ))}
        </Frame>
      );
    case "cafe":
      return (
        <Frame {...p} bg={tint}>
          <ellipse cx="60" cy="150" rx="120" ry="30" fill={SEA} />
          <rect x="150" y="70" width="130" height="80" fill="#a1887f" />
          <polygon points="140,70 290,70 215,35" fill="#6d4c41" />
          <rect x="170" y="90" width="90" height="40" fill="#9fc0d9" />
        </Frame>
      );
    case "bakery":
      return (
        <Frame {...p} bg={tint}>
          <path d="M0 180 Q160 110 320 180Z" fill="#9fc07a" />
          <rect x="110" y="80" width="100" height="70" fill="#f2d6b3" />
          <polygon points="100,80 220,80 160,45" fill="#b5541c" />
          <rect x="190" y="30" width="12" height="30" fill="#6d4c41" />
          <circle cx="196" cy="24" r="6" fill="#ddd" opacity=".8" />
          <rect x="130" y="110" width="30" height="40" fill="#6d4c41" />
        </Frame>
      );
    case "inn":
      return (
        <Frame {...p} bg="#e9dccb">
          <rect y="140" width="320" height="40" fill="#a8a29e" />
          <rect x="60" y="60" width="200" height="80" fill="#6d4c41" />
          <polygon points="50,60 270,60 160,20" fill="#3e2723" />
          {[80, 130, 180, 230].map((x) => (
            <rect key={x} x={x} y="80" width="24" height="26" fill="#ffd166" />
          ))}
          <rect x="145" y="105" width="30" height="35" fill="#3e2723" />
        </Frame>
      );
    case "glass":
      return (
        <Frame {...p} bg="#f1d6b8">
          <rect y="140" width="320" height="40" fill="#a8a29e" />
          <rect x="90" y="60" width="140" height="80" fill="#8d6e63" />
          {["#64b5f6", "#81c784", "#ffd54f", "#f06292"].map((c, i) => (
            <path key={c} d={`M${115 + i * 26} 125 l-4 -30 q8 -10 16 0 l-4 30z`} fill={c} opacity=".9" />
          ))}
        </Frame>
      );
    case "teahouse":
      return (
        <Frame {...p} bg="#e9f0f6">
          <rect y="130" width="320" height="50" fill="#f7f9fb" />
          <rect x="100" y="70" width="120" height="60" fill="#a1887f" />
          <polygon points="90,70 230,70 160,40" fill="#4e342e" />
          <rect x="140" y="90" width="40" height="40" fill="#5d4037" />
          <circle cx="60" cy="110" r="14" fill="#b9c99a" />
        </Frame>
      );
    default:
      return (
        <Frame {...p}>
          <rect y="120" width="320" height="60" fill={LAND} />
        </Frame>
      );
  }
}

const SKIN = "#f4d7c2";
const FACES: Record<string, { hair: string; cloth: string; accent: string }> = {
  akari: { hair: "#3e2723", cloth: "#1b4965", accent: "#ffd166" },
  rui: { hair: "#5d4037", cloth: "#7d9b76", accent: "#9fc0d9" },
  tsukino: { hair: "#8d6e63", cloth: "#f2d6b3", accent: "#b5541c" },
  minato: { hair: "#546e7a", cloth: "#37474f", accent: "#cfd8dc" },
  tsuzuri: { hair: "#4e342e", cloth: "#64b5f6", accent: "#f06292" },
  suzu: { hair: "#6d4c41", cloth: "#d9775b", accent: "#ffd54f" },
};

export function PersonArt({ k, size = 56, ...p }: Props & { k: string; size?: number }) {
  const f = FACES[k] ?? FACES.akari;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={p.className} style={p.style} role="img" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#f6efe3" />
      <path d="M20 100 Q50 60 80 100Z" fill={f.cloth} />
      <circle cx="50" cy="44" r="22" fill={SKIN} />
      <path d="M28 40 Q50 12 72 40 L72 34 Q50 20 28 34Z" fill={f.hair} />
      <circle cx="42" cy="46" r="2.2" fill="#333" />
      <circle cx="58" cy="46" r="2.2" fill="#333" />
      <path d="M43 55 Q50 60 57 55" stroke="#a0522d" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="78" cy="72" r="6" fill={f.accent} />
    </svg>
  );
}

export function SeedIcon({ state, size = 28 }: { state: "bud" | "flower" | "done"; size?: number }) {
  if (state === "flower") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="12" cy="7" rx="3" ry="5" fill="#f06292" transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="3.5" fill="#ffd54f" />
      </svg>
    );
  }
  if (state === "done") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#e2f0e1" />
        <path d="M7 12l3 3 7-7" stroke="#3b7d3a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 21 C12 15 12 12 12 10" stroke="#3b7d3a" strokeWidth="2" />
      <path d="M12 12 q-7 -2 -6 -8 q6 0 6 8z" fill="#8bc34a" />
      <ellipse cx="12" cy="6" rx="3.2" ry="4.5" fill="#8a6d3b" />
    </svg>
  );
}

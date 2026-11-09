/** 星凪諸島のゆるキャラ「ほしまる」。絵は /img/mascot/hoshimaru.png（自作）。
 * 場所ごとの小物と季節の衣装を SVG で重ねる。AR フォトの合成では PNG を canvas に直接描き、小物だけ SVG から描く。 */
import { forwardRef } from "react";

const AI = "#1b2a44";
const YAMA = "#e3a21a";
const PAPER = "#fbfcfd";
const RED = "#d9534f";

/** 400×400 のほしまる画像に合わせた座標系で小物を描く。 */
export const MascotProps = forwardRef<SVGSVGElement, { k: string; season?: string; size?: number; style?: React.CSSProperties; className?: string }>(function MascotProps(
  { k, season, size = 200, style, className },
  ref,
) {
  return (
    <svg ref={ref} viewBox="0 0 400 400" width={size} height={size} style={style} className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* 季節の衣装 */}
      {season === "winter" && (
        <g>
          <circle cx="118" cy="190" r="26" fill={PAPER} stroke={AI} strokeWidth="5" />
          <circle cx="286" cy="190" r="26" fill={PAPER} stroke={AI} strokeWidth="5" />
          <path d="M118 164 q82 -40 168 0" stroke={AI} strokeWidth="7" fill="none" strokeLinecap="round" />
          {[150, 230, 300].map((x, i) => (
            <path key={x} d="M0 -10 V10 M-10 0 H10 M-7 -7 L7 7 M-7 7 L7 -7" transform={`translate(${x} ${90 + i * 18})`} stroke={PAPER} strokeWidth="3" />
          ))}
        </g>
      )}
      {season === "spring" && (
        <g>
          {[140, 175, 210, 245, 280].map((x, i) => (
            <g key={x} transform={`translate(${x} ${128 - Math.abs(i - 2) * 8})`}>
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cy="-9" rx="6" ry="9" fill={i % 2 ? "#f8bbd0" : YAMA} stroke={AI} strokeWidth="1.5" transform={`rotate(${a})`} />)}
              <circle r="4" fill={PAPER} stroke={AI} strokeWidth="1.5" />
            </g>
          ))}
        </g>
      )}
      {season === "summer" && (
        <g>
          <ellipse cx="200" cy="138" rx="120" ry="18" fill="#f0c860" stroke={AI} strokeWidth="5" />
          <path d="M120 138 q80 -70 160 0z" fill="#f6d98a" stroke={AI} strokeWidth="5" />
          <path d="M126 128 q74 -14 148 0" stroke={AI} strokeWidth="8" fill="none" />
        </g>
      )}
      {season === "autumn" && (
        <g>
          <path d="M112 262 q88 34 176 0 l4 22 q-92 32 -184 0z" fill="#d9775b" stroke={AI} strokeWidth="5" />
          <path d="M150 276 l-10 40 l20 -8 l4 -30z" fill="#e3a14d" stroke={AI} strokeWidth="4" />
        </g>
      )}
      {/* 場所の小物 */}
      {k === "toudai" && (
        <g>
          <path d="M160 128 h80 l10 -74 h-100z" fill={PAPER} stroke={AI} strokeWidth="6" />
          <rect x="156" y="84" width="88" height="16" fill={RED} />
          <rect x="172" y="42" width="56" height="18" fill={AI} />
          <circle cx="200" cy="32" r="12" fill={YAMA} stroke={AI} strokeWidth="4" />
        </g>
      )}
      {k === "hoshimi" && (
        <g transform="rotate(-25 300 280)">
          <rect x="250" y="268" width="130" height="28" rx="8" fill={AI} />
          <rect x="360" y="262" width="26" height="40" rx="6" fill={AI} />
          <rect x="244" y="272" width="16" height="20" rx="4" fill={YAMA} />
        </g>
      )}
      {k === "yoichi" && (
        <g>
          <line x1="300" y1="200" x2="330" y2="250" stroke={AI} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="330" cy="292" rx="34" ry="42" fill={RED} stroke={AI} strokeWidth="5" />
          <rect x="314" y="246" width="32" height="10" fill={AI} />
          <rect x="316" y="330" width="28" height="8" fill={AI} />
          <path d="M310 292 h40" stroke="#ffe08a" strokeWidth="3" opacity=".8" />
        </g>
      )}
      {k === "kohan" && (
        <g>
          <path d="M118 150 q0 -40 26 -10 q-6 30 -26 10z" fill="#a9d1de" stroke={AI} strokeWidth="5" />
          <path d="M282 150 q0 -40 -26 -10 q6 30 26 10z" fill="#a9d1de" stroke={AI} strokeWidth="5" />
          <path d="M118 150 q82 -36 164 0" stroke={AI} strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>
      )}
      {k === "kazaguruma" && (
        <g transform="translate(96 150)">
          <circle r="10" fill={AI} />
          <path d="M0 0 l-48 -28 l0 28z" fill={YAMA} stroke={AI} strokeWidth="4" />
          <path d="M0 0 l28 -48 l-28 0z" fill={PAPER} stroke={AI} strokeWidth="4" />
          <path d="M0 0 l48 28 l0 -28z" fill={YAMA} stroke={AI} strokeWidth="4" />
          <path d="M0 0 l-28 48 l28 0z" fill={PAPER} stroke={AI} strokeWidth="4" />
          <line x1="0" y1="0" x2="0" y2="80" stroke={AI} strokeWidth="6" />
        </g>
      )}
      {k === "ishidatami" && (
        <g>
          <path d="M106 258 q94 46 188 0 q-10 28 -40 30 q-54 10 -108 0 q-30 -2 -40 -30z" fill="#f6c9a0" stroke={AI} strokeWidth="5" />
          <circle cx="150" cy="276" r="7" fill={PAPER} opacity=".8" />
          <circle cx="250" cy="280" r="9" fill={PAPER} opacity=".8" />
        </g>
      )}
      {k === "ongakudo" && (
        <g>
          <path d="M126 258 q74 40 148 0" stroke={RED} strokeWidth="7" fill="none" />
          <circle cx="200" cy="290" r="22" fill={YAMA} stroke={AI} strokeWidth="5" />
          <rect x="190" y="304" width="20" height="8" fill={AI} />
          <circle cx="200" cy="300" r="4" fill={AI} />
          <path d="M240 240 q14 -14 10 -30 M160 240 q-14 -14 -10 -30" stroke={AI} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
});

/** 画面表示用: 画像 + 小物。 */
export function Mascot({ k, season, size = 160, style }: { k: string; season?: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      <img src="/img/mascot/hoshimaru.png" alt="ほしまる" style={{ width: "100%", height: "100%", display: "block" }} draggable={false} />
      <MascotProps k={k} season={season} size={size} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

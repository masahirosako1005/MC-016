/** 星凪諸島のゆるキャラ「ほしまる」。場所ごとの絵は /img/mascot/hoshimaru_<svg_key>.png（自作）。 */
export const MASCOT_KEYS = ["lighthouse", "cape", "market", "lake", "windmill", "street", "hall"] as const;

export function Mascot({ k, size = 160, style, round = true }: { k: string; size?: number; style?: React.CSSProperties; round?: boolean }) {
  const key = MASCOT_KEYS.includes(k as (typeof MASCOT_KEYS)[number]) ? k : "lighthouse";
  return (
    <img
      src={`/img/mascot/hoshimaru_${key}.png`}
      alt="ほしまる"
      draggable={false}
      style={{ width: size, height: size, display: "block", objectFit: "contain", borderRadius: round ? "50%" : undefined, ...style }}
    />
  );
}

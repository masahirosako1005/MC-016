/** UI 用のほしまる（背景透過のポーズ差分 10 種、img/mascot/ui/）。文言のそばに小さく添えて、やさしい雰囲気にする。 */
export type Pose = "wave" | "cheer" | "point" | "letter" | "think" | "sleep" | "sorry" | "thanks" | "camera" | "coupon";

export function Hoshimaru({ pose, size = 72, style, flip }: { pose: Pose; size?: number; style?: React.CSSProperties; flip?: boolean }) {
  return (
    <img
      src={`/img/mascot/ui/hoshimaru_${pose}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      style={{ display: "block", width: size, height: size, objectFit: "contain", transform: flip ? "scaleX(-1)" : undefined, ...style }}
    />
  );
}

/** いまやること の種類 → ポーズ */
export function poseForTodo(kind: string): Pose {
  switch (kind) {
    case "letter":
      return "letter";
    case "flower":
    case "ready":
      return "cheer";
    case "meet":
    case "pick":
    case "adjust":
    case "date":
      return "point";
    case "done":
    case "receipt":
      return "thanks";
    case "draw":
    case "use":
      return "coupon";
    case "new":
      return "wave";
    default:
      return "point";
  }
}

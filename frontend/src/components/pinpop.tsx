/** 地図のピンのポップアップ。画面を移らずに、必要最低限（状態・営業・住所・電話・いる人）だけ見せる。
 * マップ（旅中）と計画（旅前）の両方で使う。主ボタンは呼び出し側が決める。 */
import { Avatar } from "./parts";
import { Badge } from "./ui";
import type { PlaceCard } from "../pages/Plan";

export type PinAction = { label: string; onClick: () => void; kind?: "primary" | "ghost" | "done" };

export function PinPopup({ pl, onClose, actions, showStatus = true, note }: { pl: PlaceCard; onClose: () => void; actions: PinAction[]; showStatus?: boolean; note?: string }) {
  return (
    <div className="mappop" role="dialog" aria-label={pl.name}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <img src={pl.image} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flex: "none" }} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="serif" style={{ fontSize: "1.05rem", fontWeight: 700 }}>{pl.name}</span>
            {showStatus ? (
              pl.met_today ? <Badge strong>会えた</Badge> : <Badge soft={pl.status !== "open"} strong={pl.status === "open"}>{pl.status_label}</Badge>
            ) : (
              pl.in_plan && <Badge flower>行きたい</Badge>
            )}
          </div>
          <div className="small" style={{ marginTop: 2 }}>{pl.area}{pl.hours ? `・${pl.hours}` : ""}{pl.closed ? `・${pl.closed}` : ""}</div>
          {pl.address && <div className="small muted">{pl.address}</div>}
          {pl.phone && <div className="small"><a href={`tel:${pl.phone.replace(/-/g, "")}`} style={{ color: "var(--ai-700)" }}>☎ {pl.phone}</a></div>}
          {note && <div className="small" style={{ color: "#7a5300", marginTop: 2 }}>{note}</div>}
          <div className="row" style={{ gap: 4, marginTop: 4 }}>
            {pl.people.map((p) => <Avatar key={p.id} p={p} size="sm" met={p.met_today} dim={showStatus && !p.met_today && !(p.forecast.status === "open" || p.forecast.status === "closing_soon")} />)}
            <span className="muted small">{pl.people.map((p) => `${p.name}（${p.role}）`).join("・")}</span>
          </div>
        </div>
        <button className="iconbtn" aria-label="とじる" onClick={onClose} style={{ flex: "none" }}>×</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {actions.map((a) => (
          <button key={a.label} className={`btn grow small ${a.kind ?? "primary"} ${(a.kind ?? "primary") === "primary" ? "mark" : ""}`} onClick={a.onClick}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}

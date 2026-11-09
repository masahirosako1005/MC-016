/** マップ（旅中）: 地図で場所を選ぶ → 場所の画面で、会えた・AR・レシート・クーポン。 */
import { useCallback, useEffect, useState } from "react";
import { get, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import { GMap } from "../components/gmap";
import { Avatar, TodoCard, type Todo } from "../components/parts";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
import { Badge, Loading, SettingsIcon, TopBar } from "../components/ui";
import type { PlaceCard } from "./Plan";

export type TodayView = {
  now: string; date: string; weekday: string; season: string; season_label: string; plan_today: boolean; has_plan: boolean;
  places: PlaceCard[]; met_today: { id: number; name: string }[]; activity_today: boolean; letter_ready: boolean; todo: Todo;
};

export function useToday() {
  const [data, setData] = useState<TodayView | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await get<TodayView>("/today"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, reload };
}

/** 現在地（デモ）: 計画の場所のうち、まだ会っていない最初の場所の近く。計画がなければ星綴港。 */
export function currentPosition(places: PlaceCard[]): { x: number; y: number; label: string } {
  const next = places.find((p) => p.in_plan && !p.met_today) ?? places.find((p) => p.in_plan);
  if (next) return { x: next.map_x - 14, y: next.map_y + 16, label: "現在地" };
  const port = places.find((p) => p.svg_key === "street");
  return port ? { x: port.map_x + 10, y: port.map_y + 18, label: "現在地（星綴港）" } : { x: 210, y: 250, label: "現在地" };
}

export function MapPage({ data }: { data: TodayView | null; reload: () => Promise<void> }) {
  const t = useT();
  const [help, setHelp] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  if (!data) return <div className="page"><Loading /></div>;
  const selected = data.places.find((p) => p.id === sel) ?? null;
  const going = data.places.filter((p) => p.in_plan);
  const others = data.places.filter((p) => !p.in_plan);
  const me = currentPosition(data.places);
  const pins = data.places.map((p) => ({
    id: p.id, name: p.name, x: p.map_x, y: p.map_y,
    state: p.met_today ? ("visited" as const) : p.in_plan ? ("plan" as const) : ("normal" as const),
    order: p.in_plan ? going.findIndex((g) => g.id === p.id) + 1 : undefined,
    people: p.people.map((q) => ({ id: q.id, image: q.image, dim: !(q.forecast.status === "open" || q.forecast.status === "closing_soon") && !q.met_today })),
  }));
  return (
    <div className="page">
      <Tutorial id="map" steps={TIPS.map} trigger={help} />
      <TopBar
        title={`${data.date.slice(5).replace("-", "/")}（${data.weekday}）・${data.season_label}`}
        right={<><HelpButton onClick={() => setHelp((n) => n + 1)} /><button className="iconbtn" aria-label={t("settings")} onClick={() => navigate("/settings")}><SettingsIcon /></button></>}
      />
      <TodoCard todo={data.todo} onButton={() => (data.todo.path ? navigate(data.todo.path) : data.todo.place_id && navigate(`/place/${data.todo.place_id}`))} />
      <div style={{ position: "relative" }}>
        <GMap pins={pins} me={me} height={340} selectedId={sel} onPick={(id) => setSel((cur) => (cur === id ? null : id))} />
        {selected && <PinPopup pl={selected} onClose={() => setSel(null)} />}
      </div>
      {!selected && <p className="muted small" style={{ margin: "4px 0 0" }}>ピンをタップすると、営業時間・住所・電話がその場で見られます。</p>}
      <div className="row wrap small muted" style={{ gap: 10, margin: "6px 0 0" }}>
        <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--yamabuki)", marginRight: 4 }} />きょう行く</span>
        <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--ai-900)", marginRight: 4 }} />会えた</span>
        <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#4a90e2", marginRight: 4 }} />現在地</span>
      </div>

      {going.length > 0 && (
        <>
          <h2>{t("going_places")}</h2>
          <div className="stack">
            {going.map((pl, i) => <PlaceRow key={pl.id} pl={pl} order={i + 1} />)}
          </div>
        </>
      )}
      <h2>{going.length > 0 ? t("other_places") : "島の場所"}</h2>
      <div className="stack">
        {others.map((pl) => <PlaceRow key={pl.id} pl={pl} />)}
      </div>
      {data.met_today.length > 0 && <p className="muted small" style={{ marginTop: 16 }}>きょう会えた人: {data.met_today.map((p) => p.name).join("、")}</p>}
    </div>
  );
}

function PlaceRow({ pl, order }: { pl: PlaceCard; order?: number }) {
  return (
    <button className={`card row ${pl.in_plan && !pl.met_today ? "highlight" : ""}`} style={{ padding: 10, textAlign: "left", cursor: "pointer", width: "100%", opacity: pl.met_today ? 0.75 : 1 }} onClick={() => navigate(`/place/${pl.id}`)}>
      <div style={{ position: "relative", flex: "none" }}>
        <img src={pl.image} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 6, filter: pl.met_today ? "grayscale(.5)" : undefined }} />
        {order !== undefined && !pl.met_today && <span style={{ position: "absolute", top: -6, left: -6, width: 22, height: 22, borderRadius: "50%", background: "var(--yamabuki)", color: "#fff", fontWeight: 800, display: "grid", placeItems: "center", fontSize: ".8rem" }}>{order}</span>}
        {pl.met_today && <span style={{ position: "absolute", top: -6, left: -6, width: 22, height: 22, borderRadius: "50%", background: "var(--ai-900)", color: "#fff", display: "grid", placeItems: "center", fontSize: ".8rem" }}>✓</span>}
      </div>
      <div className="grow">
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="title" style={{ fontSize: "1rem" }}>{pl.name}</span>
          {pl.met_today ? <Badge strong>会えた</Badge> : <Badge soft={pl.status !== "open"} strong={pl.status === "open"}>{pl.status_label}</Badge>}
        </div>
        <div className="row" style={{ gap: 4, marginTop: 4 }}>
          {pl.people.map((p) => <Avatar key={p.id} p={p} size="sm" met={p.met_today} dim={!p.met_today && !(p.forecast.status === "open" || p.forecast.status === "closing_soon")} />)}
          <span className="muted small">{pl.people.map((p) => p.name).join("・")}</span>
        </div>
      </div>
      <span className="muted" aria-hidden="true">›</span>
    </button>
  );
}


/** ピンのポップアップ: 画面を移らずに、必要最低限（状態・営業・住所・電話・いる人）だけ。くわしくは場所の画面へ。 */
function PinPopup({ pl, onClose }: { pl: PlaceCard; onClose: () => void }) {
  return (
    <div className="mappop" role="dialog" aria-label={pl.name}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <img src={pl.image} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flex: "none" }} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="serif" style={{ fontSize: "1.05rem", fontWeight: 700 }}>{pl.name}</span>
            {pl.met_today ? <Badge strong>会えた</Badge> : <Badge soft={pl.status !== "open"} strong={pl.status === "open"}>{pl.status_label}</Badge>}
          </div>
          <div className="small" style={{ marginTop: 2 }}>{pl.area}{pl.hours ? `・${pl.hours}` : ""}{pl.closed ? `・${pl.closed}` : ""}</div>
          {pl.address && <div className="small muted">{pl.address}</div>}
          {pl.phone && <div className="small"><a href={`tel:${pl.phone.replace(/-/g, "")}`} style={{ color: "var(--ai-700)" }}>☎ {pl.phone}</a></div>}
          <div className="row" style={{ gap: 4, marginTop: 4 }}>
            {pl.people.map((p) => <Avatar key={p.id} p={p} size="sm" met={p.met_today} dim={!p.met_today && !(p.forecast.status === "open" || p.forecast.status === "closing_soon")} />)}
            <span className="muted small">{pl.people.map((p) => `${p.name}（${p.role}）`).join("・")}</span>
          </div>
        </div>
        <button className="iconbtn" aria-label="とじる" onClick={onClose} style={{ flex: "none" }}>×</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary grow mark small" onClick={() => navigate(`/place/${pl.id}`)}>{pl.met_today || pl.status === "open" ? "この場所で 会えた・AR・レシート" : "この場所をくわしく"}</button>
      </div>
    </div>
  );
}

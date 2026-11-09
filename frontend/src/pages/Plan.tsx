/** 計画（旅前）: 行きたい場所をえらぶ → 日を決める。人は「ここにいる人」として添える。 */
import { useEffect, useRef, useState } from "react";
import { del, get, post, put, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import { IslandMap } from "../components/map";
import { Avatar, PersonLine, Photo, Steps, TodoCard, type PersonLite } from "../components/parts";
import { Badge, Loading, SettingsIcon, TopBar } from "../components/ui";

export type PersonFull = Omit<PersonLite, "forecast" | "met_today" | "shop"> & {
  forecast: { status: string; label: string; reason: string; hours: string };
  met_today: boolean;
  intro: string;
  seed: unknown;
  spot_id: number;
  shop: { id: number; name: string; area: string; category: string; hours: string; open_time: string; close_time: string; closed_weekday: number | null };
};
export type PlaceCard = {
  id: number; name: string; full_name: string; area: string; svg_key: string; image: string; description: string; access: string;
  best_season: string; best_season_label: string; map_x: number; map_y: number; in_plan: boolean;
  people: PersonFull[];
  status: "open" | "not_yet" | "closed"; status_label: string; met_today: boolean;
  voices?: { id: number; season_label: string; author: string; text: string; hashtags: string }[];
  photos?: { id: number; url: string; taken_on: string; is_sample?: boolean }[];
};
export type PlacesView = { season: string; season_label: string; areas: string[]; places: PlaceCard[]; map: MapItem[]; note: string };
export type MapItem = { id: number; name: string; map_x: number; map_y: number; in_plan: boolean; people: { id: number; image: string; status: string; met_today: boolean }[] };
export type PlanView = {
  exists: boolean; id?: number; target_date: string | null; weekday: string | null; days_until: number | null; season_label: string | null;
  items: { kind: string; id: number; name: string; area: string; image: string | null; source: string; people: { id: number; name: string; role: string; image: string; shop_name: string }[] }[];
  people_that_day: { id: number; name: string; role: string; image: string; place_name: string; available: boolean; note: string }[];
  seeds_in_season: { id: number; title: string; person_name: string; season_label: string }[];
  coupons_usable: { id: number; name: string }[];
};

const SEASONS = [
  { k: "spring", l: "春" },
  { k: "summer", l: "夏" },
  { k: "autumn", l: "秋" },
  { k: "winter", l: "冬" },
];

export function PlanPage({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const [data, setData] = useState<PlacesView | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [area, setArea] = useState("");
  const [season, setSeason] = useState("");
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const dateRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const p = new URLSearchParams({ q, area, season });
    const [d, pl] = await Promise.all([get<PlacesView>(`/places?${p}`), get<PlanView>("/plan")]);
    setData(d);
    setPlan(pl);
    setDate(pl.target_date ?? "");
  };
  useEffect(() => {
    const id = setTimeout(() => load().catch((e) => toast((e as Error).message, "error")), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, area, season]);

  if (!data || !plan) return <div className="page"><Loading /></div>;
  const count = plan.items.length;
  const step = count === 0 ? 0 : 1;

  const toggle = async (pl: PlaceCard) => {
    try {
      if (pl.in_plan) {
        setPlan(await del<PlanView>(`/plan/items/spot/${pl.id}`));
      } else {
        setPlan(await post<PlanView>("/plan/items", { kind: "spot", target_id: pl.id }));
        toast(`「${pl.name}」を行きたいに入れました`);
      }
      setData({ ...data, places: data.places.map((x) => (x.id === pl.id ? { ...x, in_plan: !pl.in_plan } : x)), map: data.map.map((m) => (m.id === pl.id ? { ...m, in_plan: !pl.in_plan } : m)) });
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const saveDate = async () => {
    try {
      const pl = await put<PlanView>("/plan", { target_date: date || null });
      setPlan(pl);
      toast(date ? `${date.replace(/-/g, "/")} に決めました` : "日付を空にしました");
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const todo = count === 0
    ? { kind: "pick", text: "行きたい場所を選びましょう。そこにどんな人がいるかも分かります。", button: null, path: null }
    : plan.target_date
      ? { kind: "ready", text: `${plan.target_date.slice(5).replace("-", "/")}（${plan.weekday}）に ${count} か所へ。${plan.days_until !== null && plan.days_until > 0 ? `あと ${plan.days_until} 日。` : plan.days_until === 0 ? "きょうです。" : ""}`, button: "マップで旅をはじめる", path: "/" }
      : { kind: "date", text: `${count} か所えらびました。つぎは日を決めましょう。`, button: "日を決める", path: null };

  return (
    <div className="page" style={{ paddingBottom: count > 0 ? "calc(var(--tab-h) + 80px)" : undefined }}>
      <TopBar title={t("tab_plan")} right={<button className="iconbtn" aria-label={t("settings")} onClick={() => navigate("/settings")}><SettingsIcon /></button>} />
      <TodoCard todo={todo} onButton={() => (todo.path ? navigate(todo.path) : dateRef.current?.scrollIntoView({ behavior: "smooth" }))} />
      <Steps items={[t("plan_step1"), t("plan_step2")]} current={step} />

      <IslandMap items={data.map} onPick={(id) => document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} compact />

      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <button className={`chip ${area === "" ? "on" : ""}`} onClick={() => setArea("")}>すべて</button>
        {data.areas.map((a) => (
          <button key={a} className={`chip ${area === a ? "on" : ""}`} onClick={() => setArea(area === a ? "" : a)}>{a}</button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
        <span className="muted small">この季節に行くなら:</span>
        {SEASONS.map((s) => (
          <button key={s.k} className={`chip ${season === s.k ? "on" : ""}`} onClick={() => setSeason(season === s.k ? "" : s.k)}>{s.l}</button>
        ))}
      </div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="場所・人・お店をさがす" maxLength={50} style={{ marginTop: 8 }} />

      <h2>{t("plan_step1")}</h2>
      <div className="stack">
        {data.places.length === 0 && <p className="muted">見つかりませんでした。条件をゆるめてみてください。</p>}
        {data.places.map((pl) => (
          <div key={pl.id} id={`place-${pl.id}`} className={`card ${pl.in_plan ? "highlight" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
            <Photo src={pl.image} alt={pl.name} caption={pl.name} sub={`${pl.area}・${pl.best_season_label}が見ごろ`} onClick={() => navigate(`/place/${pl.id}`)}>
              {pl.in_plan && <span className="badge flower" style={{ position: "absolute", top: 10, left: 10 }}>行きたい</span>}
            </Photo>
            <div style={{ padding: "12px 14px" }}>
              <p style={{ margin: "0 0 8px" }}>{pl.description}</p>
              <div className="muted small" style={{ marginBottom: 6 }}>{t("people_here")}</div>
              {pl.people.map((p) => (
                <PersonLine key={p.id} p={p} onClick={() => navigate(`/people/${p.id}`)} />
              ))}
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn ghost small" onClick={() => navigate(`/place/${pl.id}`)}>くわしく</button>
                <button className={`btn small grow ${pl.in_plan ? "done" : "primary mark"}`} onClick={() => toggle(pl)}>
                  {pl.in_plan ? `${t("want_done")}（はずす）` : t("want_button")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">{data.note}</p>

      {count > 0 && (
        <div ref={dateRef}>
          <h2>{t("plan_step2")}</h2>
          <div className="card stack">
            <div className="row wrap" style={{ gap: 6 }}>
              {plan.items.map((i) => (
                <span key={i.id} className="chip" style={{ cursor: "default" }}>{i.name}</span>
              ))}
            </div>
            <label className="field">
              <span>行く日（決まっていなければ空でも大丈夫）</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button className="btn primary block mark" onClick={saveDate}>この予定で決める</button>
            {plan.target_date && (
              <>
                <div className="muted small">{plan.target_date.replace(/-/g, "/")}（{plan.weekday}）・{plan.season_label}{plan.days_until !== null && plan.days_until > 0 ? `・あと ${plan.days_until} 日` : ""}</div>
                {plan.people_that_day.length > 0 && (
                  <div>
                    <div className="muted small">その日に会えそうな人</div>
                    {plan.people_that_day.map((p) => (
                      <div key={p.id} className="row" style={{ padding: "4px 0" }}>
                        <Avatar p={p} size="sm" dim={!p.available} />
                        <div className="grow"><b>{p.name}</b> <span className="muted small">{p.role}・{p.place_name}</span></div>
                        <Badge soft={!p.available} strong={p.available}>{p.available ? p.note : "定休日"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {plan.seeds_in_season.length > 0 && <div className="muted small">その季節に花になる種: {plan.seeds_in_season.map((s) => `${s.person_name}の「${s.title}」`).join("、")}</div>}
                {plan.coupons_usable.length > 0 && <div className="muted small">その日に使えるクーポン: {plan.coupons_usable.map((c) => c.name).join("、")}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {count > 0 && (
        <div className="stickybar">
          <div className="inner">
            <div className="grow"><b>行きたい場所 {count} か所</b>{plan.target_date ? <span className="muted small">・{plan.target_date.slice(5).replace("-", "/")}（{plan.weekday}）</span> : null}</div>
            {plan.target_date ? (
              <button className="btn primary small" onClick={() => navigate("/")}>マップへ</button>
            ) : (
              <button className="btn primary small" onClick={() => dateRef.current?.scrollIntoView({ behavior: "smooth" })}>日を決める</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

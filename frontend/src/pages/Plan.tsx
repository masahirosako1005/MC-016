/** 計画（旅前）: 旅のプランをつくる。カードをスワイプで選ぶ → 地図で整える → 日を決める（Google カレンダーへ）。
 * 終わった旅で行けなかった場所は、次の旅のカードの先頭に出る。 */
import { useEffect, useRef, useState } from "react";
import { del, get, post, put, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import { GMap } from "../components/gmap";
import { Avatar, PersonLine, Steps, TodoCard, type PersonLite } from "../components/parts";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
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
  best_season: string; best_season_label: string; map_x: number; map_y: number; in_plan: boolean; recommend?: string | null;
  people: PersonFull[];
  status: "open" | "not_yet" | "closed"; status_label: string; met_today: boolean;
  voices?: { id: number; season_label: string; author: string; text: string; hashtags: string }[];
  photos?: { id: number; url: string; taken_on: string; is_sample?: boolean }[];
};
export type PlacesView = { season: string; season_label: string; areas: string[]; places: PlaceCard[]; map: MapItem[]; note: string };
export type MapItem = { id: number; name: string; map_x: number; map_y: number; in_plan: boolean; people: { id: number; image: string; status: string; met_today: boolean }[] };
export type PlanView = {
  exists: boolean; id?: number; title: string | null; target_date: string | null; weekday: string | null; days_until: number | null; season_label: string | null;
  items: { kind: string; id: number; name: string; area: string; image: string | null; source: string; people: { id: number; name: string; role: string; image: string; shop_name: string }[] }[];
  people_that_day: { id: number; name: string; role: string; image: string; place_name: string; available: boolean; note: string }[];
  seeds_in_season: { id: number; title: string; person_name: string; season_label: string }[];
  coupons_usable: { id: number; name: string }[];
};
type HistItem = { id: number; name: string; image: string; visited: boolean };
type History = {
  plans: { id: number; title: string; target_date: string | null; weekday: string | null; archived: boolean; created_at: string; items: HistItem[]; unvisited: HistItem[] }[];
  active: { id: number; title: string } | null;
  leftovers: (HistItem & { from_title: string; from_date: string | null })[];
};

function decidedKey(planId: number | undefined) {
  return `hitomeguri.deck.decided.${planId ?? 0}`;
}
function loadDecided(planId: number | undefined): Record<number, "go" | "skip"> {
  try {
    return JSON.parse(localStorage.getItem(decidedKey(planId)) || "{}");
  } catch {
    return {};
  }
}

export function PlanPage({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const [data, setData] = useState<PlacesView | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [hist, setHist] = useState<History | null>(null);
  const [decided, setDecided] = useState<Record<number, "go" | "skip">>({});
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [help, setHelp] = useState(0);
  const [stage, setStage] = useState<"list" | "deck" | "map" | "date">("list");
  const [newTitle, setNewTitle] = useState("");

  const load = async () => {
    const [d, pl, h] = await Promise.all([get<PlacesView>("/places"), get<PlanView>("/plan"), get<History>("/plan/history")]);
    setData(d);
    setPlan(pl);
    setHist(h);
    setDate(pl.target_date ?? "");
    setTitle(pl.title ?? "");
    if (!pl.exists) {
      setStage("list");
      return;
    }
    const dec = loadDecided(pl.id);
    setDecided(dec);
    const allDone = d.places.every((p) => dec[p.id] || p.in_plan);
    if (pl.target_date) setStage("date");
    else if (allDone && d.places.some((p) => p.in_plan)) setStage("map");
    else setStage("deck");
  };
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data || !plan || !hist) return <div className="page"><Loading /></div>;
  const count = plan.items.length;
  const leftoverIds = new Set(hist.leftovers.map((l) => l.id));
  const remaining = data.places
    .filter((p) => !decided[p.id] && !p.in_plan)
    .sort((a, b) => Number(leftoverIds.has(b.id)) - Number(leftoverIds.has(a.id)));

  const saveDecided = (next: Record<number, "go" | "skip">) => {
    setDecided(next);
    try {
      localStorage.setItem(decidedKey(plan.id), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const setPlace = async (pl: PlaceCard, want: boolean) => {
    try {
      if (want && !pl.in_plan) setPlan(await post<PlanView>("/plan/items", { kind: "spot", target_id: pl.id }));
      if (!want && pl.in_plan) setPlan(await del<PlanView>(`/plan/items/spot/${pl.id}`));
      setData({ ...data, places: data.places.map((x) => (x.id === pl.id ? { ...x, in_plan: want } : x)) });
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const decide = async (pl: PlaceCard, d: "go" | "skip") => {
    saveDecided({ ...decided, [pl.id]: d });
    await setPlace(pl, d === "go");
    if (remaining.length <= 1) setStage("map");
  };
  const restartDeck = () => {
    saveDecided({});
    setStage("deck");
  };
  const saveDate = async () => {
    try {
      const pl = await put<PlanView>("/plan", { target_date: date || null, title: title || null });
      setPlan(pl);
      toast(date ? `${date.replace(/-/g, "/")} に決めました` : "日付を空にしました");
      onChanged?.();
      setHist(await get<History>("/plan/history"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const startNew = async () => {
    try {
      await post("/plan/new", { title: newTitle || null });
      setNewTitle("");
      await load();
      setStage("deck");
      toast("新しい旅をつくりました。行きたい場所を選びましょう");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const gcalUrl = plan.target_date
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${plan.title || "星凪諸島へ"}（ひとめぐり便）`)}&dates=${plan.target_date.replace(/-/g, "")}/${nextDay(plan.target_date)}&details=${encodeURIComponent(`行く場所: ${plan.items.map((i) => i.name).join("、")}\n会えそうな人: ${plan.people_that_day.filter((p) => p.available).map((p) => p.name).join("、")}`)}&location=${encodeURIComponent("星凪諸島")}`
    : null;

  const todo = stage === "list"
    ? { kind: "new", text: hist.plans.length === 0 ? "はじめての旅のプランをつくりましょう。" : hist.leftovers.length > 0 ? `前の旅で行けなかった場所が ${hist.leftovers.length} か所。つぎの旅でどうぞ。` : "つぎの旅のプランをつくりましょう。", button: null, path: null }
    : stage === "deck"
      ? { kind: "pick", text: remaining.length === data.places.length ? "行きたい場所を選びましょう。カードを右へスワイプで「行く」、左で「行かない」。" : `あと ${remaining.length} 枚。右で「行く」、左で「行かない」。`, button: null, path: null }
      : stage === "map"
        ? { kind: "adjust", text: count > 0 ? `${count} か所えらびました。地図で確かめて、よければ日を決めましょう。` : "行きたい場所がありません。地図のピンをタップして選べます。", button: count > 0 ? "日を決める" : null, path: null }
        : plan.target_date
          ? { kind: "ready", text: `${plan.target_date.slice(5).replace("-", "/")}（${plan.weekday}）に ${count} か所へ。${plan.days_until !== null && plan.days_until > 0 ? `あと ${plan.days_until} 日。` : plan.days_until === 0 ? "きょうです。" : ""}`, button: "マップで旅をはじめる", path: "/" }
          : { kind: "date", text: `${count} か所えらびました。つぎは日を決めましょう。`, button: null, path: null };

  return (
    <div className="page">
      <Tutorial id="plan" steps={TIPS.plan} trigger={help} />
      <TopBar
        title={stage === "list" ? "旅のプラン" : plan.title || t("tab_plan")}
        backTo={stage !== "list" && plan.exists ? undefined : undefined}
        right={<><HelpButton onClick={() => setHelp((n) => n + 1)} /><button className="iconbtn" aria-label={t("settings")} onClick={() => navigate("/settings")}><SettingsIcon /></button></>}
      />
      <TodoCard todo={todo} onButton={() => (todo.path ? navigate(todo.path) : setStage("date"))} />

      {stage === "list" && (
        <>
          <div className="card stack">
            <div className="title" style={{ fontSize: "1.05rem" }}>新しい旅をつくる</div>
            <label className="field" style={{ margin: 0 }}>
              <span>旅の名前（空でも大丈夫）</span>
              <input type="text" value={newTitle} maxLength={30} onChange={(e) => setNewTitle(e.target.value)} placeholder="例: 秋の星凪、ふたたび" />
            </label>
            <button className="btn primary block mark" onClick={startNew}>行きたい場所を選びはじめる</button>
          </div>
          {hist.leftovers.length > 0 && (
            <>
              <h2>前の旅で行けなかった場所</h2>
              <div className="stack">
                {hist.leftovers.map((l) => (
                  <div key={l.id} className="card row" style={{ padding: 10 }}>
                    <img src={l.image} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6 }} />
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>{l.name}</div>
                      <div className="muted small">「{l.from_title}」{l.from_date ? `（${l.from_date.replace(/-/g, "/")}）` : ""}で行けなかった場所。新しい旅のカードの先頭に出ます。</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <PastPlans hist={hist} />
        </>
      )}

      {stage !== "list" && (
        <>
          <Steps items={["場所をえらぶ", "地図で整える", "日を決める"]} current={stage === "deck" ? 0 : stage === "map" ? 1 : 2} />

          {stage === "deck" && (
            <>
              <div className="progress" style={{ marginBottom: 10 }}><i style={{ width: `${((data.places.length - remaining.length) / data.places.length) * 100}%` }} /></div>
              {remaining.length > 0 ? (
                <Deck cards={remaining.slice(0, 2)} total={remaining.length} leftoverIds={leftoverIds} onDecide={decide} />
              ) : (
                <div className="card">
                  <p>すべてのカードを見ました。</p>
                  <button className="btn primary block" onClick={() => setStage("map")}>地図で確かめる</button>
                </div>
              )}
              {count > 0 && (
                <div className="row between" style={{ marginTop: 12 }}>
                  <span className="muted small">行く: {plan.items.map((i) => i.name).join("、")}</span>
                  <button className="btn ghost small" onClick={() => setStage("map")}>地図へ</button>
                </div>
              )}
            </>
          )}

          {stage === "map" && (
            <>
              <GMap
                selectable
                height={320}
                pins={data.places.map((p) => ({ id: p.id, name: p.name, x: p.map_x, y: p.map_y, state: p.in_plan ? "plan" : "off", order: p.in_plan ? plan.items.findIndex((it) => it.id === p.id) + 1 : undefined }))}
                onPick={(id) => {
                  const pl = data.places.find((p) => p.id === id);
                  if (pl) setPlace(pl, !pl.in_plan);
                }}
              />
              <p className="muted small" style={{ margin: "6px 0 10px" }}>山吹のピンが行きたい場所。ピンをタップすると外したり、戻したりできます。</p>
              <div className="stack">
                {plan.items.map((i) => (
                  <div key={i.id} className="card row" style={{ padding: 10 }}>
                    {i.image && <img src={i.image} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6 }} />}
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>{i.name}</div>
                      <div className="muted small">{t("people_here")}: {i.people.map((p) => p.name).join("、") || "—"}</div>
                    </div>
                    <button className="btn ghost small" onClick={() => { const pl = data.places.find((p) => p.id === i.id); if (pl) setPlace(pl, false); }}>はずす</button>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn ghost grow" onClick={restartDeck}>カードからやり直す</button>
                <button className="btn primary grow mark" disabled={count === 0} onClick={() => setStage("date")}>日を決める</button>
              </div>
            </>
          )}

          {stage === "date" && (
            <div className="stack">
              <GMap height={200} pins={data.places.filter((p) => p.in_plan).map((p) => ({ id: p.id, name: p.name, x: p.map_x, y: p.map_y, state: "plan", order: plan.items.findIndex((it) => it.id === p.id) + 1 }))} onPick={() => setStage("map")} />
              <div className="card stack">
                <label className="field">
                  <span>旅の名前</span>
                  <input type="text" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder="例: 秋の星凪、ふたたび" />
                </label>
                <label className="field">
                  <span>行く日</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <button className="btn primary block mark" onClick={saveDate}>この予定で決める</button>
                {plan.target_date && (
                  <>
                    <div className="muted small">{plan.target_date.replace(/-/g, "/")}（{plan.weekday}）・{plan.season_label}{plan.days_until !== null && plan.days_until > 0 ? `・あと ${plan.days_until} 日` : ""}</div>
                    <div className="row">
                      {gcalUrl && <a className="btn grow small" href={gcalUrl} target="_blank" rel="noreferrer">Google カレンダーに入れる</a>}
                      <a className="btn ghost grow small" href="/api/plan/ics" download="hitomeguri.ics">カレンダー用ファイル</a>
                    </div>
                    <div className="muted small">予定を入れておくと、お店の人にも「その日に来る」が伝わります（運営の窓の来訪予定）。</div>
                  </>
                )}
              </div>
              {plan.target_date && plan.people_that_day.length > 0 && (
                <div className="card">
                  <div className="muted small" style={{ marginBottom: 4 }}>その日に会えそうな人</div>
                  {plan.people_that_day.map((p) => (
                    <div key={p.id} className="row" style={{ padding: "4px 0" }}>
                      <Avatar p={p} size="sm" dim={!p.available} />
                      <div className="grow"><b>{p.name}</b> <span className="muted small">{p.role}・{p.place_name}</span></div>
                      <Badge soft={!p.available} strong={p.available}>{p.available ? p.note : "定休日"}</Badge>
                    </div>
                  ))}
                  {plan.seeds_in_season.length > 0 && <div className="muted small" style={{ marginTop: 6 }}>その季節に花になる種: {plan.seeds_in_season.map((s) => `${s.person_name}の「${s.title}」`).join("、")}</div>}
                  {plan.coupons_usable.length > 0 && <div className="muted small">その日に使えるクーポン: {plan.coupons_usable.map((c) => c.name).join("、")}</div>}
                </div>
              )}
              <div className="row">
                <button className="btn ghost grow" onClick={() => setStage("map")}>場所を直す</button>
                {plan.target_date && <button className="btn primary grow" onClick={() => navigate("/")}>マップへ</button>}
              </div>
            </div>
          )}
          <details className="fold" style={{ marginTop: 16 }}>
            <summary>これまでの旅のプラン（{hist.plans.filter((p) => p.archived).length}）</summary>
            <PastPlans hist={hist} />
          </details>
        </>
      )}
    </div>
  );
}

function PastPlans({ hist }: { hist: History }) {
  const past = hist.plans.filter((p) => p.archived);
  if (past.length === 0) return <p className="muted small" style={{ marginTop: 8 }}>終わった旅はまだありません。</p>;
  return (
    <>
      <h2>これまでの旅のプラン</h2>
      <div className="stack">
        {past.map((p) => (
          <div key={p.id} className="card">
            <div className="row between">
              <span className="title" style={{ fontSize: "1rem" }}>{p.title}</span>
              <span className="muted small">{p.target_date ? `${p.target_date.replace(/-/g, "/")}（${p.weekday}）` : "日付なし"}</span>
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
              {p.items.map((i) => (
                <span key={i.id} className="chip" style={{ cursor: "default", opacity: i.visited ? 1 : 0.7 }}>
                  {i.visited ? "✓ " : ""}{i.name}{!i.visited && <span className="muted small">　行けなかった</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** スワイプの山札。右=行く、左=行かない。 */
function Deck({ cards, total, leftoverIds, onDecide }: { cards: PlaceCard[]; total: number; leftoverIds: Set<number>; onDecide: (pl: PlaceCard, d: "go" | "skip") => void }) {
  const t = useT();
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const [leaving, setLeaving] = useState<"go" | "skip" | null>(null);
  const top = cards[0];
  if (!top) return null;
  const finish = (d: "go" | "skip") => {
    setLeaving(d);
    setTimeout(() => {
      setLeaving(null);
      setDx(0);
      onDecide(top, d);
    }, 220);
  };
  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDx(e.clientX - start.current);
  };
  const onUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (dx > 90) finish("go");
    else if (dx < -90) finish("skip");
    else setDx(0);
  };
  const x = leaving === "go" ? 600 : leaving === "skip" ? -600 : dx;
  const rot = x / 20;
  return (
    <>
      <div className="deck">
        {cards[1] && (
          <div className="dcard behind">
            <img src={cards[1].image} alt="" style={{ width: "100%", height: 220, objectFit: "cover" }} />
          </div>
        )}
        <div className="dcard" style={{ transform: `translateX(${x}px) rotate(${rot}deg)`, transition: start.current === null ? "transform .22s ease" : "none" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div style={{ position: "relative" }}>
            <img src={top.image} alt={top.name} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} draggable={false} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(27,42,68,.05), rgba(27,42,68,.55))" }} />
            {leftoverIds.has(top.id) && <span className="badge flower" style={{ position: "absolute", top: 10, left: 10 }}>前回行けなかった場所</span>}
            <div style={{ position: "absolute", left: 14, bottom: 12, color: "#fbfcfd" }}>
              <div className="serif" style={{ fontSize: "1.5rem" }}>{top.name}</div>
              <div className="small">{top.area}・{top.best_season_label}が見ごろ</div>
            </div>
            <div className="stamp go" style={{ opacity: Math.min(1, Math.max(0, x / 90)) }}>行く</div>
            <div className="stamp skip" style={{ opacity: Math.min(1, Math.max(0, -x / 90)) }}>行かない</div>
          </div>
          <div style={{ padding: "10px 14px" }}>
            <p style={{ margin: "0 0 8px", fontSize: ".95rem" }}>{top.description}</p>
            {top.recommend && <p className="small" style={{ margin: "0 0 8px", color: "#7a5300" }}>★ お店からのおすすめ: {top.recommend}</p>}
            <div className="muted small">{t("people_here")}</div>
            {top.people.map((p) => (
              <PersonLine key={p.id} p={p} onClick={() => navigate(`/people/${p.id}`)} />
            ))}
          </div>
        </div>
      </div>
      <div className="deck-actions">
        <button className="btn ghost" onClick={() => finish("skip")}>← 行かない</button>
        <button className="btn primary mark" onClick={() => finish("go")}>行く →</button>
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <button className="btn ghost small" onClick={() => navigate(`/place/${top.id}`)}>この場所をくわしく</button>
        <span className="muted small">あと {total} 枚</span>
      </div>
    </>
  );
}

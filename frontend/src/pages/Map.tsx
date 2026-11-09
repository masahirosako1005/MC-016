/** マップ（旅中）: 島の地図の上で、行った先の人に会う。主ボタンは状態で 1 つ。 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, get, post, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { Seed } from "../types";
import { IslandMap } from "../components/map";
import { Avatar, Photo, TodoCard, type Todo } from "../components/parts";
import { SeedIcon } from "../components/art";
import { Badge, Loading, LongPressButton, SettingsIcon, TopBar } from "../components/ui";
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

export function MapPage({ data, reload }: { data: TodayView | null; reload: () => Promise<void> }) {
  const t = useT();
  const [openId, setOpenId] = useState<number | null>(null);
  if (!data) return <div className="page"><Loading /></div>;
  const going = data.places.filter((p) => p.in_plan);
  const others = data.places.filter((p) => !p.in_plan);
  const mapItems = data.places.map((p) => ({ id: p.id, name: p.name, map_x: p.map_x, map_y: p.map_y, in_plan: p.in_plan, people: p.people.map((q) => ({ id: q.id, image: q.image, status: q.forecast.status, met_today: q.met_today })) }));
  const pick = (id: number) => {
    setOpenId(id);
    setTimeout(() => document.getElementById(`mp-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  return (
    <div className="page">
      <TopBar
        title={`${data.date.slice(5).replace("-", "/")}（${data.weekday}）・${data.season_label}`}
        right={<button className="iconbtn" aria-label={t("settings")} onClick={() => navigate("/settings")}><SettingsIcon /></button>}
      />
      <TodoCard todo={data.todo} onButton={() => (data.todo.path ? navigate(data.todo.path) : data.todo.place_id && pick(data.todo.place_id))} />
      <IslandMap items={mapItems} onPick={pick} />
      <p className="muted small" style={{ margin: "6px 0 0" }}>地図の場所をタップすると、そこにいる人が出ます。山吹色の輪は計画の場所です。</p>

      {going.length > 0 && (
        <>
          <h2>{t("going_places")}</h2>
          <div className="stack">
            {going.map((pl) => <PlaceBlock key={pl.id} pl={pl} season={data.season} open={openId === null || openId === pl.id} onChange={reload} />)}
          </div>
        </>
      )}
      <h2>{going.length > 0 ? t("other_places") : "島の場所"}</h2>
      {going.length > 0 ? (
        <details className="fold card" open={openId !== null && others.some((o) => o.id === openId)}>
          <summary>ほかの {others.length} か所を見る</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            {others.map((pl) => <PlaceBlock key={pl.id} pl={pl} season={data.season} open={openId === pl.id} onChange={reload} />)}
          </div>
        </details>
      ) : (
        <div className="stack">
          {others.map((pl) => <PlaceBlock key={pl.id} pl={pl} season={data.season} open={openId === pl.id} onChange={reload} />)}
        </div>
      )}
      {data.met_today.length > 0 && <p className="muted" style={{ marginTop: 16 }}>きょう会えた人: {data.met_today.map((p) => p.name).join("、")}</p>}
    </div>
  );
}

function PlaceBlock({ pl, season, open, onChange }: { pl: PlaceCard; season: string; open: boolean; onChange: () => Promise<void> }) {
  const t = useT();
  const [expanded, setExpanded] = useState(open);
  useEffect(() => setExpanded(open), [open]);
  return (
    <div id={`mp-${pl.id}`} className={`card ${pl.in_plan ? "highlight" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
      <Photo src={pl.image} alt={pl.name} ratio={expanded ? "3 / 2" : "4 / 1"} caption={pl.name} sub={`${pl.area}・${pl.status_label}`} onClick={() => setExpanded((e) => !e)}>
        {pl.in_plan && <span className="badge flower" style={{ position: "absolute", top: 10, left: 10 }}>計画の場所</span>}
        {pl.met_today && <span className="badge strong" style={{ position: "absolute", top: 10, right: 10 }}>会えた</span>}
      </Photo>
      {expanded && (
        <div style={{ padding: "10px 14px 14px" }} className="stack">
          <div className="muted small">{t("people_here")}</div>
          {pl.people.map((p) => <PersonAction key={p.id} p={p} onChange={onChange} />)}
          <button className="btn ghost small" onClick={() => navigate(`/place/${pl.id}`)}>この場所について</button>
        </div>
      )}
      {!expanded && (
        <button className="btn ghost block small" style={{ border: 0, borderRadius: 0 }} onClick={() => setExpanded(true)}>
          {pl.people.map((p) => p.name).join("・")} がいます ▾
        </button>
      )}
      {void season}
    </div>
  );
}

export function PersonAction({ p, onChange }: { p: PlaceCard["people"][number]; onChange: () => Promise<void> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const seed = p.seed as Seed | null;
  const canMeet = p.forecast.status === "open" || p.forecast.status === "closing_soon";
  const meet = async () => {
    setBusy(true);
    try {
      const r = await post<{ already: boolean; relationship: { label: string }; new_seed: boolean; seed: Seed | null }>("/meetings", { person_id: p.id });
      if (!r.already) toast(r.new_seed && r.seed ? `${r.relationship.label}！ ${r.seed.season_label}の約束「${r.seed.title}」が種になりました` : `${r.relationship.label}！`);
      await onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const fulfill = async () => {
    if (!seed) return;
    try {
      const r = await post<{ next: Seed | null }>(`/seeds/${seed.id}/fulfill`);
      toast(r.next ? `約束を果たしました。${r.next.season_label}の種「${r.next.title}」をもらいました` : "約束を果たしました");
      await onChange();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "失敗しました", "error");
    }
  };
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="row">
        <Avatar p={p} met={p.met_today} dim={!canMeet && !p.met_today} />
        <div className="grow">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="title" style={{ fontSize: "1rem" }}>{p.name}</span>
            <span className="muted small">{p.role}</span>
            {p.relationship && p.relationship.stage !== "none" && <Badge>{p.relationship.label}</Badge>}
          </div>
          <div className="muted small">{p.shop?.name}・{p.forecast.reason}</div>
          {p.event && <div className="small" style={{ color: "var(--ai-700)", fontWeight: 700 }}>{p.event.label}</div>}
          {seed && (
            <div className="row small" style={{ gap: 6, marginTop: 4 }}>
              <SeedIcon state={seed.state} size={18} />
              <span>{seed.season_label}の約束「{seed.title}」{seed.state === "flower" ? "が咲いています" : "（つぼみ）"}</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        {!p.met_today ? (
          <button className={`btn block small ${canMeet ? "primary mark" : "ghost"}`} disabled={busy || !canMeet} onClick={meet}>
            {canMeet ? `${p.name}に${t("met_button")}` : p.forecast.label}
          </button>
        ) : seed?.can_fulfill ? (
          <LongPressButton className="primary block small" onComplete={fulfill}>{t("fulfill_hint")}</LongPressButton>
        ) : (
          <button className="btn primary block small mark" onClick={() => navigate(`/camera/person/${p.id}`)}>{t("ar_photo")}</button>
        )}
        {p.met_today && (
          <div className="row" style={{ marginTop: 6 }}>
            {seed?.can_fulfill && <button className="btn ghost small grow" onClick={() => navigate(`/camera/person/${p.id}`)}>{t("ar_photo")}</button>}
            <button className="btn ghost small grow" onClick={() => navigate(`/wallet?receipt=1&shop=${p.shop?.id ?? ""}`)}>{t("receipt_button")}</button>
            <button className="btn ghost small grow" onClick={() => navigate(`/shop/${p.shop?.id}`)}>クーポン</button>
          </div>
        )}
      </div>
    </div>
  );
}

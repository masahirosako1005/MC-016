import { useCallback, useEffect, useState } from "react";
import { get, post, toast, ApiError } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { PersonItem, Seed, TodayView } from "../types";
import { PersonArt, SceneArt, SeedIcon } from "../components/art";
import { Badge, Loading, LongPressButton, SettingsIcon, TopBar } from "../components/ui";

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

export function TodayPage({ data, reload }: { data: TodayView | null; reload: () => Promise<void> }) {
  const t = useT();
  if (!data) return <Loading />;
  const metToday = data.people.filter((p) => p.met_today);
  return (
    <div className="page">
      <TopBar
        title={`${data.date.slice(5).replace("-", "/")}（${data.weekday}）・${data.season_label}`}
        right={
          <button className="iconbtn" aria-label={t("settings")} onClick={() => navigate("/settings")}>
            <SettingsIcon />
          </button>
        }
      />
      {data.plan_today && <div className="card highlight muted">{t("plan_today_hint")}</div>}
      {data.letter_ready ? (
        <button className="btn primary block" onClick={() => navigate("/memories/letters")}>
          {t("letter_ready")}
        </button>
      ) : data.activity_today ? (
        <p className="muted">{t("letter_wait")}</p>
      ) : null}

      <h2>{t("today_title")}</h2>
      <div className="stack">
        {data.people.map((p) => (
          <PersonCard key={p.person.id} item={p} onChange={reload} />
        ))}
      </div>

      <h2>{t("today_spots")}</h2>
      <div className="stack">
        {data.spots.map((s) => (
          <div key={s.id} className={`card ${s.in_plan ? "highlight" : ""}`}>
            <div className="row">
              <div style={{ width: 96, flex: "none" }}>
                <SceneArt k={s.svg_key} season={data.season} />
              </div>
              <div className="grow">
                <div className="title">{s.name}</div>
                <div className="muted">{s.area}{s.in_plan ? "・つぎの旅" : ""}</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {s.checked_in_today ? (
                <>
                  <span className="btn done small grow">{t("checkin_done")}</span>
                  <button className="btn primary small grow" onClick={() => navigate(`/camera/spot/${s.id}`)}>
                    {t("ar_photo")}
                  </button>
                </>
              ) : (
                <button
                  className="btn primary small block"
                  onClick={async () => {
                    try {
                      await post("/checkins", { spot_id: s.id });
                      await reload();
                    } catch (e) {
                      toast((e as Error).message, "error");
                    }
                  }}
                >
                  {t("checkin_button")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2>{t("today_unmanned")}</h2>
      <div className="stack">
        {data.unmanned_shops.map((s) => (
          <div key={s.id} className={`card ${s.in_plan ? "highlight" : ""}`}>
            <div className="row between">
              <div>
                <div className="title">{s.name}</div>
                <div className="muted">{s.area}・{s.category}・{s.forecast.reason}</div>
              </div>
              <button className="btn small" onClick={() => navigate(`/shop/${s.id}`)}>お店</button>
            </div>
          </div>
        ))}
      </div>

      <h2>{t("receipt_button")}</h2>
      <button className="btn block" onClick={() => navigate("/wallet?receipt=1")}>
        {t("receipt_button")}
      </button>
      {metToday.length > 0 && <p className="muted" style={{ marginTop: 16 }}>きょう会えた人: {metToday.map((p) => p.person.name).join("、")}</p>}
    </div>
  );
}

function statusKind(s: PersonItem["forecast"]["status"]): "good" | "warn" | undefined {
  if (s === "open") return "good";
  if (s === "closing_soon") return "warn";
  return undefined;
}

export function PersonCard({ item, onChange }: { item: PersonItem; onChange: () => Promise<void> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const meet = async () => {
    setBusy(true);
    try {
      const r = await post<{ already: boolean; relationship: { label: string }; new_seed: boolean; seed: Seed | null }>("/meetings", { person_id: item.person.id });
      if (!r.already) {
        toast(r.new_seed && r.seed ? `${r.relationship.label}！ ${r.seed.season_label}の種「${r.seed.title}」をもらいました` : `${r.relationship.label}！`);
      }
      await onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const fulfill = async () => {
    if (!item.seed) return;
    try {
      const r = await post<{ next: Seed | null }>(`/seeds/${item.seed.id}/fulfill`);
      toast(r.next ? `約束を果たしました。${r.next.season_label}の種「${r.next.title}」をもらいました` : "約束を果たしました");
      await onChange();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "失敗しました", "error");
    }
  };
  const canMeet = item.forecast.status === "open" || item.forecast.status === "closing_soon";
  return (
    <div className={`card ${item.in_plan ? "highlight" : ""}`}>
      <div className="row">
        <div className="avatar">
          <PersonArt k={item.person.svg_key} />
        </div>
        <div className="grow">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="title">{item.person.name}</span>
            <Badge kind={statusKind(item.forecast.status)}>{item.forecast.label}</Badge>
            {item.relationship.stage !== "none" && <Badge>{item.relationship.label}</Badge>}
          </div>
          <div className="muted">{item.shop.name}・{item.shop.area}</div>
          <div className="muted">{item.forecast.reason}</div>
          {item.event && <div style={{ color: "var(--warn)", fontWeight: 700 }}>{item.event.label}</div>}
        </div>
      </div>
      {item.seed && (
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <SeedIcon state={item.seed.state} />
          <div className="grow">
            <Badge kind={item.seed.state === "flower" ? "flower" : "seed"}>{item.seed.state === "flower" ? t("seed_flower") : t("seed_bud")}</Badge>{" "}
            <span>{item.seed.season_label}の約束「{item.seed.title}」</span>
            <div className="muted">{item.seed.hint}</div>
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        {item.met_today ? (
          <>
            <span className="btn done small grow">{t("met_done")}</span>
            {item.seed?.can_fulfill ? (
              <LongPressButton className="primary small grow" onComplete={fulfill}>
                {t("fulfill_hint")}
              </LongPressButton>
            ) : (
              <button className="btn primary small grow" onClick={() => navigate(`/camera/person/${item.person.id}`)}>
                {t("ar_photo")}
              </button>
            )}
          </>
        ) : (
          <button className="btn primary small block" disabled={busy || !canMeet} onClick={meet}>
            {canMeet ? t("met_button") : item.forecast.label}
          </button>
        )}
      </div>
      {item.met_today && item.seed?.can_fulfill && (
        <button className="btn small block" style={{ marginTop: 8 }} onClick={() => navigate(`/camera/person/${item.person.id}`)}>
          {t("ar_photo")}
        </button>
      )}
    </div>
  );
}

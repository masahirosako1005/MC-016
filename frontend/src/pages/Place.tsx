/** 場所の詳細と、人の詳細。 */
import { useEffect, useState } from "react";
import { del, get, post, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import { Avatar, PersonLine, Photo } from "../components/parts";
import { SeedIcon } from "../components/art";
import { Badge, Loading, TopBar } from "../components/ui";
import type { PlaceCard } from "./Plan";
import { PersonAction } from "./Map";

export function PlacePage({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const t = useT();
  const [pl, setPl] = useState<PlaceCard | null>(null);
  const load = async () => setPl(await get<PlaceCard>(`/places/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!pl) return <div className="page"><Loading /></div>;
  const toggle = async () => {
    try {
      if (pl.in_plan) await del(`/plan/items/spot/${pl.id}`);
      else await post("/plan/items", { kind: "spot", target_id: pl.id });
      toast(pl.in_plan ? "行きたいからはずしました" : `「${pl.name}」を行きたいに入れました`);
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const onTrip = pl.status === "open" || pl.met_today;
  return (
    <div className="page">
      <TopBar title={pl.name} backTo="/plan" />
      <Photo src={pl.image} alt={pl.name} caption={pl.name} sub={`${pl.area}・${pl.best_season_label}が見ごろ`} />
      <p style={{ marginTop: 12 }}>{pl.description}</p>
      <p className="muted small">アクセス: {pl.access}</p>
      <button className={`btn block ${pl.in_plan ? "done" : "primary mark"}`} onClick={toggle}>{pl.in_plan ? `${t("want_done")}（はずす）` : t("want_button")}</button>

      <h2>{t("people_here")}</h2>
      <div className="stack">
        {pl.people.map((p) => (
          onTrip ? (
            <PersonAction key={p.id} p={p} onChange={async () => { await load(); onChanged?.(); }} />
          ) : (
            <div key={p.id} className="card">
              <PersonLine p={p} onClick={() => navigate(`/people/${p.id}`)} />
              <p className="muted small" style={{ margin: "4px 0 0" }}>{p.intro}</p>
              <div className="muted small">{p.shop.name}・{p.shop.hours}</div>
            </div>
          )
        ))}
      </div>

      {pl.voices && pl.voices.length > 0 && (
        <>
          <h2>{t("voices")}</h2>
          <div className="stack">
            {pl.voices.map((v) => (
              <div key={v.id} className="card letter">
                <div className="row between"><span className="muted small">{v.author}</span><Badge soft>{v.season_label}</Badge></div>
                <div>{v.text}</div>
                <div className="muted small">{v.hashtags}</div>
              </div>
            ))}
            <p className="muted small">デモ用の内部データです。本番では SNS 公式 API 等に差し替える前提です。</p>
          </div>
        </>
      )}
      {pl.photos && pl.photos.length > 0 && (
        <>
          <h2>みんなの一枚</h2>
          <div className="grid3">
            {pl.photos.map((p) => (
              <button key={p.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }} onClick={() => navigate(`/photo/${p.id}`)}>
                <img src={p.url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type PersonDetail = PlaceCard["people"][number] & {
  promises: { id: number; season_label: string; title: string; note: string; start_md: string | null; end_md: string | null; current: boolean }[];
  voices: { id: number; season_label: string; author: string; text: string; hashtags: string }[];
  photos: { id: number; url: string }[];
  fulfilled: { title: string; season_label: string; fulfilled_on: string }[];
  place: { id: number; name: string; area: string; image: string; in_plan: boolean } | null;
  shop: PlaceCard["people"][number]["shop"] & { description?: string; rate_percent?: number };
};

export function PersonPage({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const t = useT();
  const [p, setP] = useState<PersonDetail | null>(null);
  const load = async () => setP(await get<PersonDetail>(`/people/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!p) return <div className="page"><Loading /></div>;
  const seed = p.seed as { state: "bud" | "flower"; season_label: string; title: string; hint: string } | null;
  const canMeet = p.forecast.status === "open" || p.forecast.status === "closing_soon";
  const wantPlace = async () => {
    if (!p.place) return;
    try {
      await post("/plan/items", { kind: "spot", target_id: p.place.id });
      toast(`${p.name}のいる「${p.place.name}」を行きたいに入れました`);
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      <TopBar title={p.name} backTo={p.place ? `/place/${p.place.id}` : "/plan"} />
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar p={p} size="lg" met={p.met_today} />
        <div className="grow">
          <div className="title" style={{ fontSize: "1.4rem" }}>{p.name}</div>
          <div className="muted">{p.role}・{p.shop.name}</div>
          {p.relationship && p.relationship.stage !== "none" && <Badge>{p.relationship.label}（会えた日 {p.relationship.days} 日）</Badge>}
          <p style={{ margin: "6px 0 0" }}>{p.intro}</p>
        </div>
      </div>
      {p.place && (
        <div style={{ marginTop: 12 }}>
          <Photo src={p.place.image} alt={p.place.name} ratio="3 / 1" caption={p.place.name} sub={`${p.place.area}・${p.shop.hours}${p.shop.closed_weekday !== null && p.shop.closed_weekday !== undefined ? `・${"月火水木金土日"[p.shop.closed_weekday]}曜定休` : "・無休"}`} onClick={() => navigate(`/place/${p.place!.id}`)} />
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        {canMeet || p.met_today ? (
          <PersonAction p={p} onChange={async () => { await load(); onChanged?.(); }} />
        ) : p.place?.in_plan ? (
          <button className="btn done block">{p.place.name}は行きたいに入っています</button>
        ) : (
          <button className="btn primary block mark" onClick={wantPlace}>{p.place?.name}を行きたいに入れる</button>
        )}
      </div>
      {seed && (
        <div className="card row" style={{ marginTop: 10 }}>
          <SeedIcon state={seed.state} size={32} />
          <div className="grow">
            <Badge flower={seed.state === "flower"}>{seed.state === "flower" ? t("seed_flower") : t("seed_bud")}</Badge> {seed.season_label}の約束「{seed.title}」
            <div className="muted small">{seed.hint}</div>
          </div>
        </div>
      )}
      <h2>{t("promises")}</h2>
      <div className="card stack">
        {p.promises.map((pr) => (
          <div key={pr.id} className="row" style={{ opacity: pr.current ? 1 : 0.75 }}>
            <Badge strong={pr.current}>{pr.season_label}</Badge>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{pr.title}</div>
              <div className="muted small">{pr.note}{pr.start_md ? `（${pr.start_md.replace("-", "/")}〜${pr.end_md?.replace("-", "/")}）` : ""}</div>
            </div>
          </div>
        ))}
        {p.fulfilled.length > 0 && <div className="muted small">果たした約束: {p.fulfilled.map((f) => `${f.season_label}「${f.title}」`).join("、")}</div>}
      </div>
      {p.voices.length > 0 && (
        <>
          <h2>{t("voices")}</h2>
          <div className="stack">
            {p.voices.map((v) => (
              <div key={v.id} className="card letter">
                <div className="row between"><span className="muted small">{v.author}</span><Badge soft>{v.season_label}</Badge></div>
                <div>{v.text}</div>
                <div className="muted small">{v.hashtags}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {p.photos.length > 0 && (
        <>
          <h2>いっしょに撮った一枚</h2>
          <div className="grid3">
            {p.photos.map((ph) => (
              <button key={ph.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }} onClick={() => navigate(`/photo/${ph.id}`)}>
                <img src={ph.url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

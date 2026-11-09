import { useEffect, useState } from "react";
import { get, post, del, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import { IslandMap, type MapSpot } from "../components/map";
import { SceneArt } from "../components/art";
import { Badge, Loading, TopBar } from "../components/ui";

export type Voice = { id: number; season: string; season_label: string; author: string; text: string; hashtags: string };
export type Promise_ = { id: number; season: string; season_label: string; title: string; note: string; start_md: string | null; end_md: string | null };
export type Card = {
  kind: "spot" | "shop"; id: number; name: string; area: string; svg_key: string; description: string; access: string;
  best_season: string; best_season_label: string; category: string; voices: Voice[];
  shops?: { id: number; name: string; category: string }[];
  person?: { id: number; name: string; intro: string; svg_key: string; promises: Promise_[] } | null;
  hours?: string; is_unmanned?: boolean; forecast?: { label: string; reason: string };
  photos?: { id: number; taken_on: string; is_sample: boolean; url: string }[];
  in_plan?: boolean;
};
type ExploreView = { season: string; season_label: string; areas: string[]; categories: string[]; cards: Card[]; spots_for_map: MapSpot[]; note: string };
export type PlanView = {
  exists: boolean; id?: number; target_date: string | null; days_until: number | null; season_label: string | null;
  items: { kind: "spot" | "shop"; id: number; name: string; area: string; svg_key: string; category: string; source: string }[];
  seeds_in_season: { id: number; title: string; person_name: string; season_label: string }[];
  coupons_usable: { id: number; category: string; name: string; face_value: number }[];
};

const SEASONS = [
  { k: "spring", l: "春" },
  { k: "summer", l: "夏" },
  { k: "autumn", l: "秋" },
  { k: "winter", l: "冬" },
];

export function ExplorePage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState<ExploreView | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);

  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q, area, season, category });
        setData(await get<ExploreView>(`/explore?${p.toString()}`));
      } catch (e) {
        toast((e as Error).message, "error");
      }
    }, 150);
    return () => clearTimeout(id);
  }, [q, area, season, category]);
  useEffect(() => {
    get<PlanView>("/plan").then(setPlan).catch(() => undefined);
  }, []);

  const planIds = new Set((plan?.items ?? []).filter((i) => i.kind === "spot").map((i) => i.id));

  return (
    <div className="page">
      <TopBar title={t("explore_title")} />
      <PlanSummary plan={plan} />
      {data && <IslandMap spots={data.spots_for_map} highlight={planIds} />}
      <label className="field" style={{ marginTop: 12 }}>
        <span>{t("explore_search")}</span>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例: 紅葉、パン、灯台" maxLength={50} />
      </label>
      <div className="row wrap" style={{ gap: 6 }}>
        {data?.categories.map((c) => (
          <button key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => setCategory(category === c ? "" : c)}>{c}</button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
        {SEASONS.map((s) => (
          <button key={s.k} className={`chip ${season === s.k ? "on" : ""}`} onClick={() => setSeason(season === s.k ? "" : s.k)}>{s.l}</button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
        {data?.areas.map((a) => (
          <button key={a} className={`chip ${area === a ? "on" : ""}`} onClick={() => setArea(area === a ? "" : a)}>{a}</button>
        ))}
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          {data.cards.length === 0 && <p className="muted">見つかりませんでした</p>}
          {data.cards.map((c) => (
            <button key={`${c.kind}-${c.id}`} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 0, overflow: "hidden" }} onClick={() => navigate(`/place/${c.kind}/${c.id}`)}>
              <SceneArt k={c.svg_key} season={season || data.season} style={{ borderRadius: 0 }} />
              <div style={{ padding: 12 }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="title">{c.name}</span>
                  <Badge>{c.category}</Badge>
                  <Badge kind="seed">{c.best_season_label}が見ごろ</Badge>
                </div>
                <div className="muted">{c.area}{c.hours ? `・${c.hours}` : ""}</div>
                <p style={{ margin: "6px 0 0" }}>{c.description}</p>
                {c.voices[0] && (
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    “{c.voices[0].text}” <span>{c.voices[0].hashtags}</span>
                  </p>
                )}
              </div>
            </button>
          ))}
          <p className="muted">{data.note}</p>
        </div>
      )}
    </div>
  );
}

export function PlanSummary({ plan }: { plan: PlanView | null }) {
  const t = useT();
  if (!plan) return null;
  return (
    <button className="card highlight" style={{ textAlign: "left", cursor: "pointer", width: "100%", marginBottom: 12 }} onClick={() => navigate("/plan")}>
      <div className="row between">
        <span className="title">{t("next_trip")}</span>
        {plan.exists && plan.days_until !== null && (
          <Badge kind={plan.days_until <= 0 ? "flower" : undefined}>{plan.days_until > 0 ? `あと ${plan.days_until} 日` : plan.days_until === 0 ? "きょう" : "予定日をすぎました"}</Badge>
        )}
      </div>
      {!plan.exists || plan.items.length === 0 ? (
        <div className="muted">行きたい場所を入れて、つぎの旅をつくりましょう</div>
      ) : (
        <>
          <div className="muted">
            {plan.target_date ? `${plan.target_date.replace(/-/g, "/")}（${plan.season_label}）・` : "予定日は未定・"}
            {plan.items.length} か所
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
            {plan.items.map((i) => (
              <span key={`${i.kind}${i.id}`} className="chip">{i.name.replace(/（.*/, "")}</span>
            ))}
          </div>
          {plan.seeds_in_season.length > 0 && (
            <div className="muted" style={{ marginTop: 6 }}>その季節に花になる種: {plan.seeds_in_season.map((s) => `${s.person_name}の「${s.title}」`).join("、")}</div>
          )}
          {plan.coupons_usable.length > 0 && <div className="muted">その日に使えるクーポン: {plan.coupons_usable.length} 枚</div>}
        </>
      )}
    </button>
  );
}

export function PlanPage() {
  const t = useT();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [date, setDate] = useState("");
  const load = async () => {
    const p = await get<PlanView>("/plan");
    setPlan(p);
    setDate(p.target_date ?? "");
  };
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!plan) return <div className="page"><Loading /></div>;
  return (
    <div className="page">
      <TopBar title={t("next_trip")} backTo="/explore" />
      <div className="card">
        <label className="field">
          <span>予定日（決まっていなければ空でも大丈夫）</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button
          className="btn primary block"
          onClick={async () => {
            try {
              const p = await (await import("../api")).put<PlanView>("/plan", { target_date: date || null });
              setPlan(p);
              toast(date ? `予定日を ${date.replace(/-/g, "/")} にしました` : "予定日を空にしました");
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        >
          予定日を保存
        </button>
        {plan.days_until !== null && <p className="muted" style={{ marginTop: 8 }}>{plan.days_until > 0 ? `あと ${plan.days_until} 日（${plan.season_label}）` : plan.days_until === 0 ? "きょうが予定日です" : "予定日をすぎています"}</p>}
      </div>
      <h2>行く場所</h2>
      {plan.items.length === 0 && <p className="muted">まだありません。「しらべる」から入れられます。</p>}
      <div className="stack">
        {plan.items.map((i) => (
          <div key={`${i.kind}${i.id}`} className="card row">
            <div style={{ width: 80, flex: "none" }}><SceneArt k={i.svg_key} /></div>
            <div className="grow">
              <div className="title">{i.name}</div>
              <div className="muted">{i.area}・{i.category}{i.source === "wish" ? "・おもいで便の「行きたい」から" : ""}</div>
            </div>
            <button
              className="btn small ghost"
              onClick={async () => {
                setPlan(await del<PlanView>(`/plan/items/${i.kind}/${i.id}`));
              }}
            >
              はずす
            </button>
          </div>
        ))}
      </div>
      {plan.seeds_in_season.length > 0 && (
        <>
          <h2>その季節に花になる種</h2>
          <div className="card">{plan.seeds_in_season.map((s) => <div key={s.id}>{s.person_name}の「{s.title}」（{s.season_label}）</div>)}</div>
        </>
      )}
      {plan.coupons_usable.length > 0 && (
        <>
          <h2>その日に使えるクーポン</h2>
          <div className="card">{plan.coupons_usable.map((c) => <div key={c.id}>{c.name}</div>)}</div>
        </>
      )}
    </div>
  );
}

export function PlacePage({ kind, id }: { kind: string; id: number }) {
  const t = useT();
  const [c, setC] = useState<Card | null>(null);
  const load = async () => setC(await get<Card>(`/place/${kind}/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);
  if (!c) return <div className="page"><Loading /></div>;
  const togglePlan = async () => {
    try {
      if (c.in_plan) {
        await del(`/plan/items/${kind}/${id}`);
        toast("つぎの旅からはずしました");
      } else {
        await post(`/plan/items`, { kind, target_id: id });
        toast("つぎの旅に入れました");
      }
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      <TopBar title={c.name} backTo="/explore" />
      <SceneArt k={c.svg_key} season={c.best_season} />
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <Badge>{c.category}</Badge>
        <Badge kind="seed">{c.best_season_label}が見ごろ</Badge>
        {c.forecast && <Badge kind="good">{c.forecast.label}</Badge>}
      </div>
      <p>{c.description}</p>
      <p className="muted">アクセス: {c.access}{c.hours ? `／営業 ${c.hours}` : ""}</p>
      <button className={`btn block ${c.in_plan ? "done" : "primary"}`} onClick={togglePlan}>
        {c.in_plan ? t("in_plan") : t("add_to_plan")}
      </button>
      {c.kind === "shop" && (
        <button className="btn block ghost" style={{ marginTop: 8 }} onClick={() => navigate(`/shop/${c.id}`)}>お店のページ（クーポン）</button>
      )}
      {c.person && (
        <>
          <h2>{c.person.name}の{t("promises")}</h2>
          <div className="card stack">
            <div className="muted">{c.person.intro}</div>
            {c.person.promises.map((p) => (
              <div key={p.id} className="row">
                <Badge kind="seed">{p.season_label}</Badge>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div className="muted">{p.note}{p.start_md ? `（${p.start_md.replace("-", "/")}〜${p.end_md?.replace("-", "/")}）` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {c.shops && c.shops.length > 0 && (
        <>
          <h2>この場所のお店</h2>
          <div className="stack">
            {c.shops.map((s) => (
              <button key={s.id} className="card row between" style={{ cursor: "pointer", textAlign: "left" }} onClick={() => navigate(`/place/shop/${s.id}`)}>
                <span>{s.name}</span>
                <Badge>{s.category}</Badge>
              </button>
            ))}
          </div>
        </>
      )}
      <h2>{t("voices")}</h2>
      <div className="stack">
        {c.voices.map((v) => (
          <div key={v.id} className="card">
            <div className="row between"><span className="muted">{v.author}</span><Badge kind="seed">{v.season_label}</Badge></div>
            <div>{v.text}</div>
            <div className="muted">{v.hashtags}</div>
          </div>
        ))}
        <p className="muted">デモ用の内部データです。本番では SNS 公式 API 等に差し替える前提です。</p>
      </div>
      {c.photos && c.photos.length > 0 && (
        <>
          <h2>みんなの一枚</h2>
          <div className="grid3">
            {c.photos.map((p) => (
              <button key={p.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }} onClick={() => navigate(`/photo/${p.id}`)}>
                <img src={p.url} alt="" style={{ width: "100%", borderRadius: 8, display: "block" }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { get, post, put, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { Relationship, Seed } from "../types";
import { PersonArt, SceneArt, SeedIcon } from "../components/art";
import { Badge, Loading, LongPressButton, TopBar } from "../components/ui";

type LetterIndex = {
  letters: { day: string; weekday: string; season_label: string; trip_start: string; trip_end: string; redelivered: boolean; opened: boolean; summary: string }[];
  pending_today: boolean; open_hour: number; wish_count: number;
};
type Suggestion = { kind: "season" | "event" | "shop"; target_type: string; target_id: number; title: string; note: string; shop_id: number | null; wished: boolean };
type Letter = {
  day: string; weekday: string; season: string; season_label: string; trip_start: string; trip_end: string; redelivered: boolean; days_since_trip: number;
  people: { id: number; name: string; svg_key: string; shop_name: string; relationship: Relationship }[];
  spots: { id: number; name: string; area: string; svg_key: string }[];
  photos: { id: number; url: string; kind: string; is_sample: boolean }[];
  receipts: { count: number; total: number; points: number };
  diary: string; suggestions: Suggestion[]; next_season_label: string; next_season_start: string; weeks_to_next_season: number; greeting: string;
};

export function MemoriesPage({ sub, day, onChanged }: { sub: string; day?: string; onChanged?: () => void }) {
  const t = useT();
  const seg = sub === "book" ? "book" : "letters";
  return (
    <div className="page">
      <TopBar title={t("tab_memories")} />
      <div className="segment" role="tablist">
        <button role="tab" aria-selected={seg === "letters"} className={seg === "letters" ? "on" : ""} onClick={() => navigate("/memories/letters")}>{t("memories_letters")}</button>
        <button role="tab" aria-selected={seg === "book"} className={seg === "book" ? "on" : ""} onClick={() => navigate("/memories/book")}>{t("memories_book")}</button>
      </div>
      {seg === "book" ? <Book onChanged={onChanged} /> : day ? <LetterDetail day={day} onChanged={onChanged} /> : <LetterList />}
    </div>
  );
}

function LetterList() {
  const [idx, setIdx] = useState<LetterIndex | null>(null);
  useEffect(() => {
    get<LetterIndex>("/letters").then(setIdx).catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!idx) return <Loading />;
  return (
    <div className="stack">
      {idx.pending_today && <div className="card muted">きょうの便は {idx.open_hour}:00 に届きます。</div>}
      {idx.letters.length === 0 && !idx.pending_today && <p className="muted">まだ便はありません。旅に出て「会えた」「行けた」を押すと、その夜に届きます。</p>}
      {idx.letters.map((l) => (
        <button key={l.day} className={`card ${l.redelivered ? "highlight" : ""}`} style={{ textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/memories/letters/${l.day}`)}>
          <div className="row between">
            <span className="title">{l.day.slice(5).replace("-", "/")}（{l.weekday}）の便</span>
            <span className="row" style={{ gap: 4 }}>
              {l.redelivered && <Badge kind="flower">30 日後にもう一度</Badge>}
              {!l.opened && <Badge kind="warn">未読</Badge>}
            </span>
          </div>
          <div className="muted">{l.season_label}・{l.summary}</div>
        </button>
      ))}
    </div>
  );
}

function LetterDetail({ day, onChanged }: { day: string; onChanged?: () => void }) {
  const [L, setL] = useState<Letter | null>(null);
  const [diary, setDiary] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const l = await get<Letter>(`/letters/${day}`);
    setL(l);
    setDiary(l.diary);
  };
  useEffect(() => {
    load()
      .then(() => post(`/letters/${day}/open`).catch(() => undefined))
      .catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);
  if (!L) return <Loading />;
  const wish = async (s: Suggestion) => {
    try {
      await post("/wishes", { kind: s.kind, target_type: s.target_type, target_id: s.target_id, label: s.title });
      toast("「行きたい」を覚えました。つぎの旅の候補に入れました");
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="stack">
      <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/memories/letters")}>← 便の一覧</button>
      <div className="card highlight">
        <div className="row between">
          <span className="title">{L.day.replace(/-/g, "/")}（{L.weekday}）・{L.season_label}</span>
          {L.redelivered && <Badge kind="flower">もう一度届いた便</Badge>}
        </div>
        <p style={{ margin: "6px 0 0" }}>{L.greeting}</p>
      </div>

      <Collage L={L} />

      {L.redelivered && (
        <div className="card" style={{ borderColor: "var(--flower)" }}>
          <div className="title">{L.next_season_label}まで、あと {L.weeks_to_next_season} 週間</div>
          <div className="muted">{L.next_season_start.replace(/-/g, "/")} から{L.next_season_label}。種が花になる季節です。</div>
        </div>
      )}

      <h2 style={{ margin: "6px 0 0" }}>次の旅の提案</h2>
      {L.suggestions.map((s) => (
        <div key={`${s.kind}${s.target_id}`} className={`card ${s.wished ? "highlight" : ""}`}>
          <div className="row between">
            <Badge kind="seed">{s.kind === "season" ? "別の季節" : s.kind === "event" ? "別のイベント" : "別のお店"}</Badge>
            {s.wished && <Badge kind="good">行きたい</Badge>}
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{s.title}</div>
          <div className="muted">{s.note}</div>
          {!s.wished ? (
            <button className="btn small primary block" style={{ marginTop: 8 }} onClick={() => wish(s)}>行きたい</button>
          ) : (
            <button className="btn small ghost block" style={{ marginTop: 8 }} onClick={() => navigate("/plan")}>つぎの旅を見る</button>
          )}
        </div>
      ))}

      <h2 style={{ margin: "6px 0 0" }}>一言日記（140 字まで）</h2>
      <div className="card">
        <textarea value={diary} maxLength={140} onChange={(e) => setDiary(e.target.value)} placeholder="この日のことをひとこと" />
        <div className="row between" style={{ marginTop: 6 }}>
          <span className="muted">{diary.length} / 140</span>
          <button
            className="btn small primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await put(`/diaries/${day}`, { text: diary });
                toast("日記を保存しました");
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            保存
          </button>
        </div>
      </div>
      <p className="muted">この便の中身は保存されず、開くたびに記録から組み立てられます。保存されるのは日記と「行きたい」だけです。</p>
    </div>
  );
}

function Collage({ L }: { L: Letter }) {
  const tiles: JSX.Element[] = [];
  L.photos.forEach((p) => tiles.push(
    <button key={`ph${p.id}`} style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }} onClick={() => navigate(`/photo/${p.id}`)}>
      <img src={p.url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10, display: "block" }} />
    </button>,
  ));
  L.people.forEach((p) => tiles.push(
    <div key={`pe${p.id}`} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 10 }}>
      <PersonArt k={p.svg_key} size={64} />
      <div style={{ fontWeight: 700 }}>{p.name}</div>
      <Badge>{p.relationship.label}</Badge>
    </div>,
  ));
  L.spots.forEach((s) => tiles.push(
    <div key={`sp${s.id}`} style={{ position: "relative" }}>
      <SceneArt k={s.svg_key} season={L.season} />
      <div style={{ position: "absolute", left: 6, bottom: 6, background: "#fffd", borderRadius: 6, padding: "2px 6px", fontSize: "0.8rem" }}>{s.name.split("（")[0]}</div>
    </div>,
  ));
  return (
    <div className="card" style={{ background: "linear-gradient(135deg, #fbf7ee, #e6eef0)" }}>
      <div className="grid2">{tiles}</div>
      {L.receipts.count > 0 && (
        <div className="muted" style={{ marginTop: 8 }}>お買いもの {L.receipts.count} 件・{L.receipts.total.toLocaleString()} 円・{L.receipts.points} pt</div>
      )}
    </div>
  );
}

type BookView = {
  today: string; season_label: string;
  people: { id: number; name: string; intro: string; svg_key: string; shop: { id: number; name: string; area: string }; relationship: Relationship; met_days: string[]; met_today: boolean; seed: Seed | null; fulfilled: { title: string; season_label: string; fulfilled_on: string }[] }[];
  album: { id: number; url: string; kind: string; title: string; taken_on: string; season_label: string; is_sample: boolean }[];
  trips: { start: string; end: string; days: number; season_label: string; weekday_start: string; spots: string[]; people: string[]; photos: number; spent: number; current: boolean }[];
};

function Book({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const [b, setB] = useState<BookView | null>(null);
  const load = async () => setB(await get<BookView>("/book"));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!b) return <Loading />;
  const fulfill = async (seed: Seed) => {
    try {
      const r = await post<{ next: Seed | null }>(`/seeds/${seed.id}/fulfill`);
      toast(r.next ? `約束を果たしました。${r.next.season_label}の種「${r.next.title}」をもらいました` : "約束を果たしました");
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>お店の人と、種と花</h2>
      {b.people.map((p) => (
        <div key={p.id} className="card">
          <div className="row">
            <div className="avatar"><PersonArt k={p.svg_key} /></div>
            <div className="grow">
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="title">{p.name}</span>
                <Badge kind={p.relationship.stage === "none" ? undefined : "good"}>{p.relationship.label}</Badge>
              </div>
              <div className="muted">{p.shop.name}・会えた日 {p.relationship.days} 日</div>
            </div>
          </div>
          {p.seed ? (
            <div className="row" style={{ marginTop: 8 }}>
              <SeedIcon state={p.seed.state} size={32} />
              <div className="grow">
                <Badge kind={p.seed.state === "flower" ? "flower" : "seed"}>{p.seed.state === "flower" ? t("seed_flower") : t("seed_bud")}</Badge> {p.seed.season_label}の約束「{p.seed.title}」
                <div className="muted">{p.seed.hint}</div>
              </div>
            </div>
          ) : (
            p.relationship.days === 0 && <div className="muted" style={{ marginTop: 8 }}>会えた日に、次の季節の種をもらえます。</div>
          )}
          {p.seed?.can_fulfill && (
            <LongPressButton className="primary block" onComplete={() => fulfill(p.seed!)}>
              {t("fulfill_hint")}
            </LongPressButton>
          )}
          {p.fulfilled.length > 0 && (
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              {p.fulfilled.map((f, i) => (
                <span key={i} className="chip"><SeedIcon state="done" size={16} />&nbsp;{f.season_label}「{f.title}」</span>
              ))}
            </div>
          )}
        </div>
      ))}

      <h2 style={{ margin: "8px 0 0" }}>アルバム</h2>
      {b.album.length === 0 && <p className="muted">AR フォトを撮ると、ここに並びます。</p>}
      <div className="grid3">
        {b.album.map((p) => (
          <button key={p.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer", textAlign: "left" }} onClick={() => navigate(`/photo/${p.id}`)}>
            <img src={p.url} alt={p.title} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
            <div className="muted" style={{ fontSize: "0.75rem" }}>{p.taken_on.slice(5).replace("-", "/")} {p.title.split("（")[0]}</div>
          </button>
        ))}
      </div>

      <h2 style={{ margin: "8px 0 0" }}>これまでの旅</h2>
      {b.trips.map((tr) => (
        <div key={tr.start} className={`card ${tr.current ? "highlight" : ""}`}>
          <div className="row between">
            <span className="title">{tr.start.replace(/-/g, "/")}{tr.days > 1 ? `〜${tr.end.slice(5).replace("-", "/")}` : ""}（{tr.days} 日）</span>
            <Badge kind="seed">{tr.season_label}</Badge>
          </div>
          <div className="muted">
            {tr.spots.length > 0 && <>スポット: {tr.spots.join("、")}<br /></>}
            {tr.people.length > 0 && <>会えた人: {tr.people.join("、")}<br /></>}
            写真 {tr.photos} 枚{tr.spent > 0 ? `・お買いもの ${tr.spent.toLocaleString()} 円` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

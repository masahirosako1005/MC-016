/** 思い出: その日の思い出（コルクボード）と、30 日後の便り（リマインド）。 */
import { useEffect, useState } from "react";
import { get, post, put, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { Relationship } from "../types";
import { Avatar } from "../components/parts";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
import { Badge, Loading, TopBar } from "../components/ui";

type Reminder = {
  date: string; weekday: string; trip_start: string; trip_end: string; trip_label: string; people: string[];
  photos: { id: number; url: string }[]; wishes: { label: string; image: string | null; place: string | null }[]; diary: string | null;
  next_season_label: string; weeks_to_next_season: number; title: string;
};
type LetterIndex = {
  letters: { day: string; weekday: string; season_label: string; trip_start: string; trip_end: string; redelivered: boolean; opened: boolean; summary: string }[];
  reminders: Reminder[]; pending_today: boolean; open_hour: number; wish_count: number;
};
type Suggestion = {
  kind: "season" | "event" | "shop"; target_type: string; target_id: number; title: string; note: string; shop_id: number | null; wished: boolean;
  image: string | null; place: string | null; person: { id: number; name: string; image: string } | null;
};
type Letter = {
  day: string; weekday: string; season: string; season_label: string; trip_start: string; trip_end: string; redelivered: boolean; days_since_trip: number;
  people: { id: number; name: string; image: string; shop_name: string; relationship: Relationship }[];
  spots: { id: number; name: string; area: string; image: string }[];
  photos: { id: number; url: string; kind: string; is_sample: boolean }[];
  receipts: { count: number; total: number; points: number };
  diary: string; suggestions: Suggestion[]; next_season_label: string; next_season_start: string; weeks_to_next_season: number; greeting: string;
};

export function MemoriesPage({ sub, day, onChanged }: { sub: string; day?: string; onChanged?: () => void }) {
  const t = useT();
  const [help, setHelp] = useState(0);
  return (
    <div className="page">
      <Tutorial id="memories" steps={TIPS.memories} trigger={help} />
      <TopBar title={t("tab_memories")} backTo={day || sub === "reminder" ? "/memories" : undefined} right={<HelpButton onClick={() => setHelp((n) => n + 1)} />} />
      {sub === "reminder" && day ? <ReminderDetail date={day} /> : day ? <LetterDetail day={day} onChanged={onChanged} /> : <LetterList />}
    </div>
  );
}

function fmt(d: string) {
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
}

function LetterList() {
  const [idx, setIdx] = useState<LetterIndex | null>(null);
  useEffect(() => {
    get<LetterIndex>("/letters").then(setIdx).catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!idx) return <Loading />;
  type Item = { kind: "memory" | "reminder"; date: string; node: JSX.Element };
  const items: Item[] = [
    ...idx.reminders.map((r) => ({
      kind: "reminder" as const, date: r.date,
      node: (
        <button key={`r${r.date}`} className="card letter" style={{ textAlign: "left", cursor: "pointer", borderColor: "var(--yamabuki)" }} onClick={() => navigate(`/memories/reminder/${r.date}`)}>
          <div className="row between">
            <span className="title" style={{ fontSize: "1rem" }}>{fmt(r.date)}（{r.weekday}）星凪諸島からの便り</span>
            <Badge flower>30 日後</Badge>
          </div>
          <div className="muted small">{r.trip_label} の旅から 30 日。{r.people.length > 0 ? `${r.people.join("、")}に会った日の思い出と、` : ""}行きたい場所 {r.wishes.length} 件</div>
          <div className="row" style={{ gap: 4, marginTop: 6 }}>
            {r.photos.slice(0, 3).map((p) => <img key={p.id} src={p.url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />)}
          </div>
        </button>
      ),
    })),
    ...idx.letters.map((l) => ({
      kind: "memory" as const, date: l.day,
      node: (
        <button key={l.day} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/memories/letters/${l.day}`)}>
          <div className="row between">
            <span className="title" style={{ fontSize: "1rem" }}>{fmt(l.day)}（{l.weekday}）の思い出</span>
            {!l.opened && <Badge flower>新着</Badge>}
          </div>
          <div className="muted small">{l.season_label}・{l.summary}</div>
        </button>
      ),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="stack">
      {idx.pending_today && <div className="card muted">きょうの思い出は {idx.open_hour}:00 に届きます。</div>}
      {items.length === 0 && !idx.pending_today && <p className="muted">まだ思い出はありません。旅に出て人に会うと、その夜に届きます。</p>}
      {items.map((i) => i.node)}
    </div>
  );
}

function ReminderDetail({ date }: { date: string }) {
  const [r, setR] = useState<Reminder | null>(null);
  useEffect(() => {
    get<LetterIndex>("/letters").then((idx) => setR(idx.reminders.find((x) => x.date === date) ?? null)).catch((e) => toast((e as Error).message, "error"));
  }, [date]);
  if (!r) return <Loading />;
  return (
    <div className="stack">
      <div className="card letter">
        <div className="muted small">{r.date.replace(/-/g, "/")}（{r.weekday}）</div>
        <div className="title" style={{ fontSize: "1.2rem", marginTop: 4 }}>{r.title}</div>
        <p style={{ margin: "8px 0 0" }}>
          {r.trip_label}、{r.people.length > 0 ? `${r.people.join("、")}に会った日のこと、覚えていますか。` : "星凪諸島を歩いた日のこと、覚えていますか。"}
          {r.diary && <><br />あの日の一言: 「{r.diary}」</>}
        </p>
        <div className="muted small" style={{ marginTop: 8 }}>{r.next_season_label}まで、あと {r.weeks_to_next_season} 週間。種が花になる季節です。</div>
      </div>
      {r.photos.length > 0 && (
        <div className="cork">
          <div className="grid2" style={{ gap: 14 }}>
            {r.photos.map((p, i) => (
              <div key={p.id} className="polaroid" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (3 + i)}deg)` }} onClick={() => navigate(`/photo/${p.id}`)}>
                <span className="pin" />
                <img src={p.url} alt="" />
                <div className="cap">{r.trip_label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <h2 style={{ margin: "6px 0 0" }}>あの日「行きたい」と選んだ場所</h2>
      {r.wishes.length === 0 && <p className="muted small">「行きたい」を押した提案はありませんでした。思い出から押すと、ここに並びます。</p>}
      <div className="stack">
        {r.wishes.map((w, i) => (
          <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
            {w.image && <img src={w.image} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />}
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontWeight: 700 }}>{w.label}</div>
              {w.place && <div className="muted small">{w.place}</div>}
            </div>
          </div>
        ))}
      </div>
      <button className="btn primary block mark" onClick={() => navigate("/plan")}>つぎの旅の日を決める</button>
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
    load().then(() => post(`/letters/${day}/open`).catch(() => undefined)).catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);
  if (!L) return <Loading />;
  const wish = async (s: Suggestion) => {
    try {
      await post("/wishes", { kind: s.kind, target_type: s.target_type, target_id: s.target_id, label: s.title });
      toast("「行きたい」を覚えました。計画の候補に入れました");
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="stack">
      <div className="row between">
        <span className="title" style={{ fontSize: "1.25rem" }}>{fmt(L.day)}（{L.weekday}）の思い出</span>
        <Badge soft>{L.season_label}</Badge>
      </div>
      <p className="muted" style={{ margin: 0 }}>{L.greeting}</p>
      <Corkboard L={L} />

      <h2 style={{ margin: "6px 0 0" }}>一言日記（140 字まで）</h2>
      <div className="card">
        <textarea value={diary} maxLength={140} onChange={(e) => setDiary(e.target.value)} placeholder="この日のことをひとこと" />
        <div className="row between" style={{ marginTop: 6 }}>
          <span className="muted small">{diary.length} / 140</span>
          <button className="btn small primary" disabled={saving} onClick={async () => { setSaving(true); try { await put(`/diaries/${day}`, { text: diary }); toast("日記を保存しました"); } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(false); } }}>保存</button>
        </div>
      </div>

      <h2 style={{ margin: "6px 0 0" }}>次の旅の提案</h2>
      {L.suggestions.map((s) => (
        <div key={`${s.kind}${s.target_id}`} className={`card ${s.wished ? "highlight" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
          {s.image && (
            <div style={{ position: "relative" }}>
              <img src={s.image} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(27,42,68,0), rgba(27,42,68,.55))" }} />
              <div style={{ position: "absolute", left: 12, bottom: 10, color: "#fbfcfd" }} className="serif">{s.place}</div>
              <span className="badge flower" style={{ position: "absolute", top: 10, left: 10 }}>{s.kind === "season" ? "別の季節に、また" : s.kind === "event" ? "別のイベント" : "まだ行っていない場所"}</span>
              {s.person && <div style={{ position: "absolute", right: 10, bottom: -18 }}><Avatar p={s.person} /></div>}
            </div>
          )}
          <div style={{ padding: "12px 12px 12px" }}>
            <div style={{ fontWeight: 700, paddingRight: 60 }}>{s.title}</div>
            <div className="muted small">{s.note}</div>
            {!s.wished ? (
              <button className="btn small primary block mark" style={{ marginTop: 8 }} onClick={() => wish(s)}>行きたい</button>
            ) : (
              <button className="btn small ghost block" style={{ marginTop: 8 }} onClick={() => navigate("/plan")}>行きたいに入れました — 計画を見る</button>
            )}
          </div>
        </div>
      ))}
      <p className="muted small">思い出の中身は保存されず、開くたびに記録から組み立てられます。保存されるのは日記と「行きたい」だけです。</p>
    </div>
  );
}

function Corkboard({ L }: { L: Letter }) {
  const tiles: { key: string; node: JSX.Element; rot: number }[] = [];
  L.photos.forEach((p, i) => tiles.push({
    key: `ph${p.id}`, rot: (i % 2 ? 1 : -1) * (2 + (i % 3)),
    node: (
      <div className="polaroid" onClick={() => navigate(`/photo/${p.id}`)} style={{ cursor: "pointer" }}>
        <span className="pin" />
        <img src={p.url} alt="" />
        <div className="cap">{fmt(L.day)} AR フォト</div>
      </div>
    ),
  }));
  L.people.forEach((p, i) => tiles.push({
    key: `pe${p.id}`, rot: (i % 2 ? -1 : 1) * (3 + (i % 2)),
    node: (
      <div className="polaroid" onClick={() => navigate(`/people/${p.id}`)} style={{ cursor: "pointer" }}>
        <span className="pin" style={{ background: "var(--ai-700)", borderColor: "var(--ai-900)" }} />
        <img src={p.image} alt={p.name} style={{ objectFit: "contain", background: "var(--ai-050)" }} />
        <div className="cap">{p.name}・{p.relationship.label}</div>
      </div>
    ),
  }));
  L.spots.forEach((s, i) => tiles.push({
    key: `sp${s.id}`, rot: (i % 2 ? 1 : -1) * 2,
    node: (
      <div className="polaroid" onClick={() => navigate(`/place/${s.id}`)} style={{ cursor: "pointer" }}>
        <span className="pin" style={{ background: "#c9527a", borderColor: "#7a1f3f" }} />
        <img src={s.image} alt={s.name} />
        <div className="cap">{s.name}</div>
      </div>
    ),
  }));
  return (
    <div className="cork">
      <div className="grid2" style={{ gap: 16, alignItems: "start" }}>
        {tiles.map((t) => <div key={t.key} style={{ transform: `rotate(${t.rot}deg)` }}>{t.node}</div>)}
        {L.diary && (
          <div className="note" style={{ transform: "rotate(2deg)" }}>
            <span className="tape" />
            <div className="serif" style={{ fontSize: ".95rem" }}>{L.diary}</div>
          </div>
        )}
        {L.receipts.count > 0 && (
          <div className="note" style={{ transform: "rotate(-2deg)", background: "#fff" }}>
            <span className="tape" />
            <div className="small">お買いもの {L.receipts.count} 件<br />{L.receipts.total.toLocaleString()} 円・{L.receipts.points} pt</div>
          </div>
        )}
      </div>
    </div>
  );
}

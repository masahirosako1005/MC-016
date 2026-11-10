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
  people_cards?: { id: number; name: string; image: string; label: string }[]; spots?: { id: number; name: string; image: string }[];
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
      <TopBar title={t("tab_memories")} backTo={sub === "message" ? "/memories/inbox" : day || sub === "reminder" ? "/memories" : undefined} right={<HelpButton onClick={() => setHelp((n) => n + 1)} />} />
      {sub === "reminder" && day ? <ReminderDetail date={day} /> : sub === "message" && day ? <MessageDetail id={Number(day)} /> : day ? <LetterDetail day={day} onChanged={onChanged} /> : <LetterList box={sub === "inbox" ? "inbox" : "memory"} />}
    </div>
  );
}

function fmt(d: string) {
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
}

type ShopMessage = {
  id: number; shop_id: number; shop_name: string; spot_id: number; person_id: number | null; person_name: string | null; person_image: string | null;
  title: string; body: string; coupon_face_value: number | null; coupon_days: number | null; created_at: string; date: string; read: boolean;
};

function LetterList({ box }: { box: "memory" | "inbox" }) {
  const [idx, setIdx] = useState<LetterIndex | null>(null);
  const [msgs, setMsgs] = useState<ShopMessage[]>([]);
  const [survey, setSurvey] = useState<{ answered: boolean; gift_count: number } | null>(null);
  useEffect(() => {
    get<LetterIndex>("/letters").then(setIdx).catch((e) => toast((e as Error).message, "error"));
    get<{ messages: ShopMessage[] }>("/messages").then((r) => setMsgs(r.messages)).catch(() => undefined);
    get<{ answered: boolean; gift_count: number }>("/survey").then(setSurvey).catch(() => undefined);
  }, []);
  if (!idx) return <Loading />;
  const unread = msgs.filter((m) => !m.read).length;
  type Item = { kind: "memory" | "reminder" | "message"; date: string; node: JSX.Element };
  const items: Item[] = [
    ...msgs.map((m) => ({
      kind: "message" as const, date: m.date,
      node: (
        <button key={`m${m.id}`} className="card letter" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/memories/message/${m.id}`)}>
          <div className="row">
            {m.person_image && <Avatar p={{ image: m.person_image, name: m.person_name ?? "" }} size="sm" />}
            <div className="grow">
              <div className="row between">
                <span className="title" style={{ fontSize: "1rem" }}>{m.person_name ?? m.shop_name}からの便り</span>
                {!m.read && <Badge flower>新着</Badge>}
              </div>
              <div className="muted small">{fmt(m.date)}・{m.title}{m.coupon_face_value ? `・クーポン ${m.coupon_face_value} 円引きつき` : ""}</div>
            </div>
          </div>
        </button>
      ),
    })),
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
  const shown = items.filter((i) => (box === "inbox" ? i.kind === "message" : i.kind !== "message"));
  return (
    <div className="stack">
      {/* 思い出便は 2 つの箱: その日の思い出（コルクボード・30 日後の便り）と、お店からの便り（お知らせの一覧） */}
      <div className="segment" role="tablist" aria-label="思い出便">
        <button role="tab" aria-selected={box === "memory"} className={box === "memory" ? "on" : ""} onClick={() => navigate("/memories")}>思い出</button>
        <button role="tab" aria-selected={box === "inbox"} className={box === "inbox" ? "on" : ""} onClick={() => navigate("/memories/inbox")}>
          お店からの便り{unread > 0 && <span className="segcount">{unread}</span>}
        </button>
      </div>
      {box === "memory" ? (
        <>
          {survey && (
            <button className="card row" style={{ textAlign: "left", cursor: "pointer", alignItems: "center" }} onClick={() => navigate(survey.answered ? "/gifts" : "/survey")}>
              <img src={`/img/mascot/ui/hoshimaru_${survey.answered ? "thanks" : "letter"}.png`} alt="" width={48} height={48} />
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{survey.answered ? "ほしまるのお礼を見る" : "旅のアンケート（任意・1 分）"}</div>
                <div className="muted small">{survey.answered ? `待ち受けなど ${survey.gift_count} 点。答え直すこともできます。` : `答えると、ほしまるの待ち受けなど ${survey.gift_count} 点をお礼に。`}</div>
              </div>
              <span className="muted" aria-hidden="true">›</span>
            </button>
          )}
          {idx.pending_today && <div className="card muted">きょうの思い出は {idx.open_hour}:00 に届きます。</div>}
          {shown.length === 0 && !idx.pending_today && <p className="muted">まだ思い出はありません。旅に出て人に会うと、その夜に届きます。</p>}
        </>
      ) : (
        <>
          <p className="muted small" style={{ margin: 0 }}>会ったことのあるお店の人から届いた便りです。クーポンが付いていれば「クーポン」タブに入っています。</p>
          {shown.length === 0 && <p className="muted">まだ届いていません。お店の人に会うと、季節のお知らせが届くことがあります。</p>}
        </>
      )}
      {shown.map((i) => i.node)}
      {box === "inbox" && survey?.answered && <button className="btn ghost small block" onClick={() => navigate("/survey")}>アンケートを答え直す</button>}
    </div>
  );
}

function MessageDetail({ id }: { id: number }) {
  const [m, setM] = useState<ShopMessage | null>(null);
  useEffect(() => {
    get<{ messages: ShopMessage[] }>("/messages")
      .then((r) => {
        const found = r.messages.find((x) => x.id === id) ?? null;
        setM(found);
        if (found && !found.read) post(`/messages/${id}/read`).catch(() => undefined);
      })
      .catch((e) => toast((e as Error).message, "error"));
  }, [id]);
  if (!m) return <Loading />;
  return (
    <div className="stack">
      <div className="card letter">
        <div className="row">
          {m.person_image && <Avatar p={{ image: m.person_image, name: m.person_name ?? "" }} />}
          <div className="grow">
            <div className="muted small">{m.date.replace(/-/g, "/")}・{m.shop_name}</div>
            <div className="title" style={{ fontSize: "1.2rem" }}>{m.title}</div>
          </div>
        </div>
        <p style={{ whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{m.body}</p>
        <div className="muted small" style={{ marginTop: 8 }}>— {m.person_name ?? m.shop_name}</div>
      </div>
      {m.coupon_face_value && (
        <div className="card" style={{ borderColor: "var(--yamabuki)" }}>
          <div className="title" style={{ fontSize: "1rem" }}>クーポンが届いています</div>
          <div className="small">{m.shop_name}で使える {m.coupon_face_value} 円引き（{m.coupon_days} 日間）。「クーポン」タブに入っています。</div>
          <button className="btn small block" style={{ marginTop: 8 }} onClick={() => navigate("/wallet")}>クーポンを見る</button>
        </div>
      )}
      <div className="row">
        <button className="btn ghost grow" onClick={() => navigate(`/place/${m.spot_id}`)}>その場所を見る</button>
        <button className="btn primary grow" onClick={() => navigate("/plan")}>また会いに行く計画を立てる</button>
      </div>
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
        </p>
        <div className="muted small" style={{ marginTop: 8 }}>{r.next_season_label}まで、あと {r.weeks_to_next_season} 週間。また会いに行く計画を、そろそろ。</div>
      </div>
      <div className="cork">
        <div className="grid2" style={{ gap: 16, alignItems: "start" }}>
          {r.photos.map((p, i) => (
            <div key={`ph${p.id}`} className="polaroid" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg)`, cursor: "pointer" }} onClick={() => navigate(`/photo/${p.id}`)}>
              <span className="pin" />
              <img src={p.url} alt="" />
              <div className="cap">{r.trip_label} AR フォト</div>
            </div>
          ))}
          {(r.people_cards ?? []).map((p, i) => (
            <div key={`pe${p.id}`} className="polaroid" style={{ transform: `rotate(${(i % 2 ? -1 : 1) * 3}deg)`, cursor: "pointer" }} onClick={() => navigate(`/people/${p.id}`)}>
              <span className="pin" style={{ background: "var(--ai-700)", borderColor: "var(--ai-900)" }} />
              <img src={p.image} alt={p.name} style={{ objectFit: "contain", background: "var(--ai-050)" }} />
              <div className="cap">{p.name}・{p.label}</div>
            </div>
          ))}
          {(r.spots ?? []).map((sp, i) => (
            <div key={`sp${sp.id}`} className="polaroid" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 2}deg)`, cursor: "pointer" }} onClick={() => navigate(`/place/${sp.id}`)}>
              <span className="pin" style={{ background: "#c9527a", borderColor: "#7a1f3f" }} />
              <img src={sp.image} alt={sp.name} />
              <div className="cap">{sp.name}</div>
            </div>
          ))}
          {r.diary && (
            <div className="note" style={{ transform: "rotate(2deg)" }}>
              <span className="tape" />
              <div className="muted small">あの日の一言</div>
              <div className="serif" style={{ fontSize: ".95rem" }}>{r.diary}</div>
            </div>
          )}
        </div>
      </div>
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
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700 }}>この日の一言（140 字まで）</span>
          <span className="muted small">{diary.length} / 140</span>
        </div>
        <textarea value={diary} maxLength={140} onChange={(e) => setDiary(e.target.value)} placeholder="この日のことをひとこと" style={{ minHeight: 72 }} />
        <button
          className="btn small primary block"
          style={{ marginTop: 6 }}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await put(`/diaries/${day}`, { text: diary });
              toast("一言をコルクボードに貼りました");
              await load();
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "保存中…" : "コルクボードに貼る"}
        </button>
      </div>
      <Corkboard L={L} />

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
      <p className="muted small">保存されるのは一言と「行きたい」だけ。ほかは開くたびに記録から組み立てます。</p>
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
        {/* 一言は上の枠で書いて、ここに付箋として貼られる */}
        {L.diary && (
          <div className="note" style={{ transform: "rotate(2deg)" }}>
            <span className="tape" />
            <div className="serif" style={{ fontSize: ".95rem", whiteSpace: "pre-wrap" }}>{L.diary}</div>
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

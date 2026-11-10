/**
 * 旅のあとの任意アンケート（#/survey）と、お礼のほしまる素材（#/gifts）。
 * 回答は地域（DMO）とお店の人が、観光の改善に使う。店や人に点数や順位はつけない。
 * 答えると、ほしまるの待ち受け・スタンプ・ぬりえ・なかま証・お礼の AR フレームがもらえる。
 */
import { useEffect, useState } from "react";
import { get, post, toast } from "../api";
import { navigate } from "../router";
import { Hoshimaru } from "../components/hoshimaru";
import { Loading, TopBar } from "../components/ui";

type Opt = { key: string; label: string };
type Form = {
  answered: boolean;
  last: { satisfaction: number; revisit: number; good: string[]; trouble: string[]; spot_id: number | null; comment: string; answered_on: string } | null;
  good: Opt[]; trouble: Opt[];
  scale: { value: number; label: string }[]; revisit: { value: number; label: string }[];
  places: { id: number; name: string; visited: boolean }[];
  gift_count: number;
};

function Scale({ items, value, onChange }: { items: { value: number; label: string }[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="scale5" role="radiogroup">
      {items.map((it) => (
        <button key={it.value} type="button" role="radio" aria-checked={value === it.value} className={value === it.value ? "on" : ""} onClick={() => onChange(it.value)}>
          <b>{it.value}</b>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SurveyPage() {
  const [f, setF] = useState<Form | null>(null);
  const [sat, setSat] = useState(0);
  const [rev, setRev] = useState(0);
  const [good, setGood] = useState<string[]>([]);
  const [trouble, setTrouble] = useState<string[]>([]);
  const [spot, setSpot] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get<Form>("/survey")
      .then((x) => {
        setF(x);
        if (x.last) {
          setSat(x.last.satisfaction);
          setRev(x.last.revisit);
          setGood(x.last.good);
          setTrouble(x.last.trouble);
          setSpot(x.last.spot_id ? String(x.last.spot_id) : "");
          setComment(x.last.comment);
        }
      })
      .catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!f) return <div className="page"><Loading /></div>;
  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const toggleTrouble = (k: string) => {
    // 「特になし」は、ほかと一緒には選べない
    if (k === "none") setTrouble(trouble.includes("none") ? [] : ["none"]);
    else toggle(trouble.filter((x) => x !== "none"), setTrouble, k);
  };
  const submit = async () => {
    if (!sat || !rev) {
      toast("満足度と「また来たいか」を選んでください", "error");
      return;
    }
    setBusy(true);
    try {
      await post("/survey", { satisfaction: sat, revisit: rev, good, trouble, spot_id: spot ? Number(spot) : null, comment: comment || null });
      toast("ありがとうございました。お礼のほしまるをどうぞ");
      navigate("/gifts");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <TopBar title="旅のアンケート" backTo="/memories" right={<Hoshimaru pose="letter" size={40} />} />
      <div className="card row" style={{ alignItems: "flex-start" }}>
        <Hoshimaru pose="thanks" size={56} />
        <div className="grow small">
          答えても答えなくても大丈夫です（1 分ほど）。声は、島の案内やお店の準備をよくするために使います。
          答えてくれた人には、<b>ほしまるの待ち受けなど {f.gift_count} 点</b>をお礼に。
          {f.answered && <div className="muted" style={{ marginTop: 4 }}>前に答えた内容が入っています。直して送り直せます。</div>}
        </div>
      </div>

      <h2>1. 今回の旅は、どうでしたか</h2>
      <Scale items={f.scale} value={sat} onChange={setSat} />

      <h2>2. また来たいと思いますか</h2>
      <Scale items={f.revisit} value={rev} onChange={setRev} />

      <h2>3. よかったこと（いくつでも）</h2>
      <div className="row wrap" style={{ gap: 6 }}>
        {f.good.map((o) => <button key={o.key} type="button" className={`chip ${good.includes(o.key) ? "on" : ""}`} onClick={() => toggle(good, setGood, o.key)}>{o.label}</button>)}
      </div>

      <h2>4. 困ったこと（いくつでも）</h2>
      <div className="row wrap" style={{ gap: 6 }}>
        {f.trouble.map((o) => <button key={o.key} type="button" className={`chip ${trouble.includes(o.key) ? "on" : ""}`} onClick={() => toggleTrouble(o.key)}>{o.label}</button>)}
      </div>

      <h2>5. ひとこと（任意）</h2>
      <div className="card stack">
        <label className="field" style={{ margin: 0 }}>
          <span>どの場所についての声ですか（任意。選ぶと、その場所のお店の人にも届きます）</span>
          <select value={spot} onChange={(e) => setSpot(e.target.value)}>
            <option value="">島ぜんたい・とくに決めない</option>
            {f.places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.visited ? "（行った）" : ""}</option>)}
          </select>
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span>気づいたこと・こうなるとうれしいこと（300 字まで）</span>
          <textarea value={comment} maxLength={300} onChange={(e) => setComment(e.target.value)} placeholder="例: 着いたら定休日でした。行く前に分かるとうれしいです。" />
        </label>
        <div className="muted small">名前は出ません。お店や人に点数や順位をつけるものではありません。</div>
      </div>

      <button className="btn primary block mark" style={{ marginTop: 14 }} disabled={busy} onClick={submit}>{busy ? "送信中…" : "送って、お礼をもらう"}</button>
      <button className="btn ghost block small" style={{ marginTop: 8 }} onClick={() => navigate("/memories")}>いまは答えない</button>
    </div>
  );
}

type GiftItem = { key: string; label: string; png?: string; width?: number; height?: number };
type Gifts = { unlocked: boolean; count: number; groups: { type: string; label: string; items: GiftItem[] }[] };

export function GiftsPage() {
  const [g, setG] = useState<Gifts | null>(null);
  useEffect(() => {
    get<Gifts>("/gifts").then(setG).catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!g) return <div className="page"><Loading /></div>;
  return (
    <div className="page">
      <TopBar title="ほしまるのお礼" backTo="/memories" right={<Hoshimaru pose="cheer" size={40} />} />
      {!g.unlocked ? (
        <div className="card row" style={{ alignItems: "flex-start" }}>
          <Hoshimaru pose="sleep" size={64} />
          <div className="grow">
            <div className="title" style={{ fontSize: "1.05rem" }}>アンケートに答えると、もらえます</div>
            <p className="muted small" style={{ margin: "4px 0 8px" }}>待ち受け・スタンプ・ぬりえ・なかま証など {g.count} 点。1 分ほどの任意アンケートです。</p>
            <button className="btn primary block mark" onClick={() => navigate("/survey")}>アンケートに答える</button>
          </div>
        </div>
      ) : (
        <>
          <div className="card row" style={{ alignItems: "flex-start" }}>
            <Hoshimaru pose="thanks" size={56} />
            <div className="grow small">答えてくれて、ありがとう。{g.count} 点のお礼です。画像を押すと保存できます。AR フォトには「ありがとう」のフレームも増えました。</div>
          </div>
          {g.groups.map((grp) =>
            grp.type === "ar_frame" ? (
              <div key={grp.type}>
                <h2>{grp.label}</h2>
                <div className="card small">AR フォトのフレームに「ありがとう（アンケートのお礼）」が増えています。次に会えた日に、選んで撮れます。</div>
              </div>
            ) : (
              <div key={grp.type}>
                <h2>{grp.label}（{grp.items.length}）</h2>
                <div className={grp.type === "sticker" ? "giftgrid stickers" : "giftgrid"}>
                  {grp.items.map((it) => (
                    <a key={it.key} className="gift" href={it.png} download={`hoshimaru_${grp.type}_${it.key}.png`} title={`${it.label}を保存`}>
                      <img src={it.png} alt={it.label} loading="lazy" style={{ aspectRatio: it.width && it.height ? `${it.width} / ${it.height}` : undefined }} />
                      <span className="small">{it.label}</span>
                      <span className="muted small">保存する</span>
                    </a>
                  ))}
                </div>
              </div>
            ),
          )}
          <button className="btn ghost small block" style={{ marginTop: 16 }} onClick={() => navigate("/survey")}>アンケートを答え直す</button>
        </>
      )}
    </div>
  );
}

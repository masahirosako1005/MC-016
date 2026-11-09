/** 発表用 1280×720。左にスマホ枠で本体（iframe）、上に 5 場面の帯、右に場面の説明と指標。DEMO_MODE=1 のときだけ。 */
import { useEffect, useRef, useState } from "react";
import { get, post, toast, ApiError } from "../api";
import { navigate } from "../router";
import { MetricsGrid } from "./Admin";

type Scene = { key: string; label: string; at: string; desc: string };
type DemoState = { now: string; date: string; weekday: string; season_label: string; scene: string | null; scenes: Scene[]; fixed_prize: number | null; prizes: { id: number; name: string; category: string }[] };

const SCRIPT: Record<string, { path: string; steps: string[]; point: string }> = {
  pre: {
    path: "/plan",
    steps: ["「計画」で行きたい場所を選ぶ（風景写真のカード。地区・季節で絞る）", "カードの下に「ここにいる人」。人はまだ選ばない、場所を選ぶだけ", "「行きたい」を 2 か所、日を 10/24 に決める"],
    point: "いきなり人を選ばせない。場所を選ぶと、そこにいる人が付いてくる。旅人の声はデモ用の内部データ（本番は公式 API に差し替え）。格付け・順位は出さない。",
  },
  trip: {
    path: "/",
    steps: ["「マップ」に計画の場所が先頭。行った先に「ここにいる人」と予報（定休日・営業時間・季節イベント）", "「〇〇さんに会えた」→ 次の季節の種 → いっしょに AR フォト（カメラ不可なら風景写真で合成）", "レシートを登録 → ポイント → 「クーポン」で抽選"],
    point: "人を選んだつもりはないのに、気づいたら人に会っている。会えたは自己申告・同じ日に同じ人は 1 回。レシート画像は 7 日で削除、数値は残す。",
  },
  night: {
    path: "/memories/letters",
    steps: ["おもいで便が届く（18:00 以降）", "会えた人・スポット・AR フォトのコラージュ、一言日記 140 字", "次の旅の提案 3 つ → 「行きたい」を押すと つぎの旅 の候補に"],
    point: "便の中身は保存せず、毎回記録から組み立てる。保存するのは日記と「行きたい」だけ。",
  },
  after30: {
    path: "/memories/letters",
    steps: ["30 日後、同じ便がもう一度届く", "「行きたい」を先頭に、次の季節まで あと N 週間", "つぎの旅の予定日を決める"],
    point: "旅の後に開く理由をつくる。再訪のきっかけは季節の便りとクーポン。",
  },
  season: {
    path: "/",
    steps: ["次の季節、種が花になる（マップのその人のカードが長押しに変わる）", "その人に「会えた」日だけ 1.2 秒長押しで約束を果たす", "さらに次の季節の種をもらう（関係: はじめまして → また会えたね → おなじみ）"],
    point: "種は人ごとに 1 つ、逃しても枯れない。「またあの人に会いたい」が次の旅の計画になる。運営の窓（/#/admin）で指標・取り込み・還元率・補填を確認。",
  },
};

export function PresentPage() {
  const [st, setSt] = useState<DemoState | null>(null);
  const [metrics, setMetrics] = useState<Parameters<typeof MetricsGrid>[0]["m"] | null>(null);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const load = async () => {
    try {
      const [s, m] = await Promise.all([get<DemoState>("/demo/state"), get<Parameters<typeof MetricsGrid>[0]["m"]>("/metrics")]);
      setSt(s);
      setMetrics(m);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast("デモ層は DEMO_MODE=1 のときだけ使えます");
        navigate("/");
      } else toast((e as Error).message, "error");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tell = (path: string) => {
    frame.current?.contentWindow?.postMessage({ type: "hitomeguri", path }, window.location.origin);
  };
  const go = async (key: string) => {
    if (!st) return;
    setBusy(true);
    try {
      if (key === "pre") await post("/demo/clock", { at: st.scenes[0].at });
      else if (key === "trip") await post("/demo/trip-day");
      else if (key === "night") await post("/demo/night");
      else if (key === "after30") await post("/demo/after30");
      else if (key === "season") await post("/demo/next-season");
      await load();
      tell(SCRIPT[key].path);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (!st) return <div className="page wide"><p className="muted">読み込み中…</p></div>;
  const cur = st.scene ?? "pre";
  const sc = SCRIPT[cur];
  return (
    <div style={{ width: 1280, height: 720, margin: "0 auto", display: "grid", gridTemplateRows: "68px 1fr", gap: 8, padding: 8, boxSizing: "border-box", background: "var(--bg)", overflow: "hidden" }}>
      <div className="row" style={{ gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: "1.1rem", marginRight: 8 }}>ひとめぐり便</div>
        {st.scenes.map((s) => (
          <button key={s.key} className={`btn small ${cur === s.key ? "primary" : ""}`} disabled={busy} style={{ flex: 1 }} onClick={() => go(s.key)} title={s.desc}>
            {s.label}
            <span className="muted" style={{ fontSize: "0.7rem", color: cur === s.key ? "#fff" : undefined }}>{s.at.slice(5, 10).replace("-", "/")} {s.at.slice(11, 16)}</span>
          </button>
        ))}
        <div style={{ textAlign: "right", minWidth: 150, fontSize: "0.85rem" }}>
          <div style={{ fontWeight: 700 }}>{st.date.replace(/-/g, "/")}（{st.weekday}）{st.now.slice(11, 16)}</div>
          <div className="muted">{st.season_label}・模擬の時計</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, minHeight: 0 }}>
        <div style={{ justifySelf: "center", width: 340, height: 630, border: "10px solid #1e2a2c", borderRadius: 36, overflow: "hidden", background: "#000", boxShadow: "0 8px 30px #0004" }}>
          <iframe ref={frame} src="/#/plan" title="ひとめぐり便（本体）" style={{ width: "100%", height: "100%", border: 0, background: "#fff" }} />
        </div>
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 8, minHeight: 0 }}>
          <div className="card">
            <div className="row between">
              <div className="title">{st.scenes.find((s) => s.key === cur)?.label} — {st.scenes.find((s) => s.key === cur)?.desc}</div>
              <button className="btn small ghost" onClick={() => tell(sc.path)}>この場面の画面へ</button>
            </div>
            <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {sc.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <div className="muted" style={{ marginTop: 4 }}>{sc.point}</div>
          </div>
          <div style={{ overflow: "auto", minHeight: 0 }}>
            {metrics && <MetricsGrid m={metrics} compact />}
            <div className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>n は対象人数、ダミーは固定乱数で補った履歴。3 人未満は非表示。</div>
          </div>
          <div className="card row wrap" style={{ gap: 8, padding: 8 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>デモ操作:</span>
            <select value={st.fixed_prize ?? ""} style={{ width: 200, minHeight: 36, padding: 4 }} onChange={async (e) => { await post("/demo/fix-lottery", { prize_id: e.target.value ? Number(e.target.value) : null }); await load(); }}>
              <option value="">次の抽選: 通常</option>
              {st.prizes.map((p) => <option key={p.id} value={p.id}>次の抽選を固定: {p.name}</option>)}
            </select>
            <button className="btn small ghost" onClick={() => tell("/wallet")}>クーポン</button>
            <button className="btn small ghost" onClick={() => tell("/memories/book")}>ひとめぐり帖</button>
            <button className="btn small ghost" onClick={() => window.open("/#/admin", "_blank")}>運営の窓</button>
            <button className="btn small ghost" style={{ marginLeft: "auto", borderColor: "var(--yamabuki)", color: "#7a5300" }} onClick={async () => { if (confirm("主人公の履歴を初期化して旅前に戻します。よろしいですか？")) { await post("/demo/reset"); await load(); tell("/plan"); } }}>初期化</button>
          </div>
        </div>
      </div>
    </div>
  );
}

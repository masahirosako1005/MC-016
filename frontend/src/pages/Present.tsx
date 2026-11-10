/** 発表用 1280×720。左にスマホ枠で本体（iframe。運営の窓もスマホ枠で見せ、PC 幅にも切り替え可）、上に場面の帯、右に 16:9 のスライド。DEMO_MODE=1 のときだけ。 */
import { useEffect, useRef, useState } from "react";
import { ApiError, get, post, toast } from "../api";
import { navigate } from "../router";
import { Mascot } from "../components/mascots";
import { MetricsGrid } from "./Admin";

type Scene = { key: string; label: string; at: string; desc: string };
type DemoState = { now: string; date: string; weekday: string; season_label: string; scene: string | null; scenes: Scene[]; fixed_prize: number | null; prizes: { id: number; name: string; category: string }[] };
type Metrics = Parameters<typeof MetricsGrid>[0]["m"];

const SCENE_PATH: Record<string, string> = { pre: "/plan", trip: "/", night: "/memories", after30: "/memories", season: "/", admin: "/admin" };
const SCREEN_NAME: Record<string, string> = { "/plan": "計画", "/": "マップ", "/memories": "思い出", "/wallet": "クーポン", "/book": "ひとめぐり帖", "/admin": "運営の窓" };

export function PresentPage() {
  const [st, setSt] = useState<DemoState | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [wide, setWide] = useState(false);
  const [screen, setScreen] = useState("/plan");
  const frame = useRef<HTMLIFrameElement>(null);

  const load = async () => {
    try {
      const [s, m] = await Promise.all([get<DemoState>("/demo/state"), get<Metrics>("/metrics")]);
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
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlide((s) => Math.min(SLIDES.length - 1, s + 1));
      if (e.key === "ArrowLeft") setSlide((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const setAdminRole = (r: "dmo" | "shop") => {
    try {
      localStorage.setItem("hitomeguri.admin.role", r);
    } catch {
      /* ignore */
    }
    setScreen("/admin");
    if (frame.current) frame.current.src = `/?r=${Date.now()}#/admin?role=${r}`;
  };
  const tell = (path: string) => {
    setScreen(path);
    frame.current?.contentWindow?.postMessage({ type: "hitomeguri", path }, window.location.origin);
  };
  const go = async (key: string) => {
    if (!st) return;
    setBusy(true);
    try {
      if (key === "admin") {
        setAdminMode(true);
        setSlide(SLIDES.findIndex((s) => s.scene === "admin"));
        tell("/admin");
        return;
      }
      setAdminMode(false);
      setWide(false);
      if (key === "pre") await post("/demo/clock", { at: st.scenes[0].at });
      else if (key === "trip") await post("/demo/trip-day");
      else if (key === "night") await post("/demo/night");
      else if (key === "after30") await post("/demo/after30");
      else if (key === "season") await post("/demo/next-season");
      await load();
      tell(SCENE_PATH[key]);
      const idx = SLIDES.findIndex((s) => s.scene === key);
      if (idx >= 0) setSlide(idx);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (!st) return <div className="page wide"><p className="muted">読み込み中…</p></div>;
  const cur = adminMode ? "admin" : (st.scene ?? "pre");
  const curScene = st.scenes.find((x) => x.key === cur);
  const S = SLIDES[slide];
  const phoneW = wide ? 760 : 340;
  return (
    <div style={{ width: 1280, height: 720, margin: "0 auto", display: "grid", gridTemplateRows: "64px 1fr", gap: 8, padding: 8, boxSizing: "border-box", background: "var(--bg)", overflow: "hidden" }}>
      {/* 場面の帯: 選んでいる場面は濃い藍 + 山吹の下線 */}
      <div className="row" style={{ gap: 6 }}>
        <div className="serif" style={{ fontWeight: 800, fontSize: "1.1rem", marginRight: 8 }}>ひとめぐり便</div>
        {st.scenes.map((x) => (
          <button key={x.key} className={`btn small ${cur === x.key ? "primary" : ""}`} disabled={busy} style={{ flex: 1, flexDirection: "column", gap: 0, lineHeight: 1.1, boxShadow: cur === x.key ? "inset 0 -4px 0 var(--yamabuki)" : undefined }} onClick={() => go(x.key)} title={x.desc}>
            <span>{x.label}</span>
            {x.key !== "admin" && <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>{x.at.slice(5, 10).replace("-", "/")} {x.at.slice(11, 16)}</span>}
          </button>
        ))}
        <div style={{ textAlign: "right", minWidth: 150, fontSize: "0.85rem" }}>
          <div style={{ fontWeight: 700 }}>{st.date.replace(/-/g, "/")}（{st.weekday}）{st.now.slice(11, 16)}</div>
          <div className="muted small">{st.season_label}・模擬の時計</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `${phoneW + 40}px 1fr`, gap: 12, minHeight: 0, transition: "grid-template-columns .25s" }}>
        {/* 左: スマホ枠（運営の窓もここで。PC 幅に切り替え可） */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 6, justifyItems: "center", minHeight: 0 }}>
          <div className="row" style={{ gap: 8, fontSize: ".85rem", alignItems: "center" }}>
            <span className="badge strong">{curScene?.label ?? ""}</span>
            <span><b>{SCREEN_NAME[screen] ?? "本体"}</b> の画面</span>
            {adminMode && <button className="btn small ghost" style={{ minHeight: 30, padding: "2px 10px" }} onClick={() => setWide((w) => !w)}>{wide ? "スマホ幅で見る" : "PC 幅で見る"}</button>}
          </div>
          <div style={{ width: phoneW, height: 590, border: "10px solid #1b2a44", borderRadius: wide ? 16 : 36, overflow: "hidden", background: "#000", boxShadow: "0 8px 30px #0004", transition: "width .25s" }}>
            <iframe ref={frame} src="/#/plan" title="ひとめぐり便（本体）" style={{ width: "100%", height: "100%", border: 0, background: "#fff" }} />
          </div>
          <div className="muted small" style={{ textAlign: "center" }}>{curScene?.desc ?? ""}</div>
        </div>

        {/* 右: 16:9 のスライド（文字は大きく、本体と同じ高さに収める） */}
        <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 8, minHeight: 0 }}>
          <div style={{ display: "grid", placeItems: "center", minHeight: 0 }}>
            <div className="card slide" style={{ position: "relative", overflow: "hidden", width: "100%", maxWidth: 860, aspectRatio: "16 / 9", padding: "26px 30px", display: "flex", flexDirection: "column", boxSizing: "border-box", borderColor: "var(--ai-900)" }}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="muted" style={{ letterSpacing: ".25em", fontSize: ".9rem" }}>{S.kicker}</div>
                  <h1 className="serif" style={{ fontSize: wide ? "1.5rem" : "1.9rem", margin: "4px 0 10px", lineHeight: 1.25 }}>{S.title}</h1>
                </div>
                <Mascot k={S.mascot ?? "lighthouse"} size={72} />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", fontSize: wide ? "1rem" : "1.15rem", lineHeight: 1.6 }}>{S.body(metrics)}</div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: "var(--ai-100)" }}>
                <div style={{ width: `${((slide + 1) / SLIDES.length) * 100}%`, height: "100%", background: "var(--yamabuki)" }} />
              </div>
            </div>
          </div>
          <div className="card row wrap" style={{ gap: 8, padding: 8, alignItems: "center" }}>
            <button className="btn ghost small" onClick={() => setSlide((x) => Math.max(0, x - 1))} disabled={slide === 0}>← 前</button>
            <span className="muted small" style={{ minWidth: 48, textAlign: "center" }}>{slide + 1} / {SLIDES.length}</span>
            <button className="btn ghost small" onClick={() => setSlide((x) => Math.min(SLIDES.length - 1, x + 1))} disabled={slide === SLIDES.length - 1}>次 →</button>
            <span style={{ width: 1, height: 24, background: "var(--ai-100)", margin: "0 4px" }} />
            <span className="muted small">本体を:</span>
            <button className="btn small ghost" onClick={() => tell("/wallet")}>クーポン</button>
            <button className="btn small ghost" onClick={() => tell("/book")}>帖</button>
            <button className="btn small ghost" onClick={() => tell(SCENE_PATH[cur] ?? "/")}>場面の画面へ</button>
            {adminMode && (
              <>
                <span style={{ width: 1, height: 24, background: "var(--ai-100)", margin: "0 4px" }} />
                <span className="muted small">運営の立場:</span>
                <button className="btn small ghost" onClick={() => setAdminRole("dmo")}>地域（DMO）</button>
                <button className="btn small ghost" onClick={() => setAdminRole("shop")}>お店・施設</button>
              </>
            )}
            <select value={st.fixed_prize ?? ""} style={{ width: 190, minHeight: 34, padding: 4, fontSize: ".85rem" }} onChange={async (e) => { await post("/demo/fix-lottery", { prize_id: e.target.value ? Number(e.target.value) : null }); await load(); }}>
              <option value="">次の抽選: 通常</option>
              {st.prizes.map((pz) => <option key={pz.id} value={pz.id}>抽選を固定: {pz.name}</option>)}
            </select>
            <button className="btn small ghost" style={{ marginLeft: "auto", borderColor: "var(--yamabuki)", color: "#7a5300" }} onClick={async () => { if (confirm("主人公の履歴を初期化して旅前に戻します。よろしいですか？")) { await post("/demo/reset"); setAdminMode(false); setWide(false); setSlide(0); await load(); tell("/plan"); } }}>初期化</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Li = ({ children }: { children: React.ReactNode }) => <li style={{ margin: "4px 0" }}>{children}</li>;

const SLIDES: { scene?: string; kicker: string; title: string; mascot?: string; body: (m: Metrics | null) => JSX.Element }[] = [
  {
    scene: "pre", kicker: "01 課題", title: "スタンプラリーは、旅の途中で終わってしまう", mascot: "lighthouse",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>既存アプリは「旅の途中」の機能だけ。旅の後に開く理由がない。</Li>
        <Li>参加後アンケートでは満足度が高いのに、2 回目の来訪につながっていない。</Li>
        <Li>再訪の理由は「場所」より「人」。でも、いきなり人を選ばせると敷居が高い。</Li>
        <Li><b>ひとめぐり便</b>: 場所を選ぶと人が付いてきて、気づいたら人に会っている。会った人との約束が、次の季節に花になる。</Li>
      </ul>
    ),
  },
  {
    scene: "pre", kicker: "02 旅前", title: "計画: カードをスワイプして、行きたい場所を選ぶ", mascot: "cape",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>風景写真のカードを右へ「行く」、左へ「行かない」。7 枚だけ。</Li>
        <Li>カードの下に「ここにいる人」。人は付加情報 — まだ選ばせない。</Li>
        <Li>選び終えると地図に並ぶ。ピンをタップして微調整。</Li>
        <Li>日を決めると、その日に会えそうな人（定休日で判定）が分かり、Google カレンダーへ。お店側にも「その日に来る」が伝わる（運営の窓の来訪予定）。</Li>
      </ul>
    ),
  },
  {
    scene: "trip", kicker: "03 旅中", title: "マップ: 行った先で、人に会う", mascot: "market",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>地図アプリ風の島の地図。山吹の番号ピンが「きょう行く場所」、青い点が現在地、会えた場所はチェック。</Li>
        <Li>場所をタップ → その場所の画面に、会えた・AR フォト・レシート・クーポンをまとめる。</Li>
        <Li>「会えた」は自己申告、同じ日に同じ人は 1 回（DB の制約）。次の季節の約束が「種」になる。</Li>
        <Li>AR フォトは、その場所の<b>ゆるキャラ「ほしまる」</b>と。場所ごとの小物、季節の衣装。ここで、きょうだけ撮れる一枚（IP に頼らない自作キャラ）。</Li>
        <Li>レシートは撮るだけ。AI-OCR が店名と金額を推定（デモは演出）。ポイント → 抽選 → 次の旅で使えるカテゴリ別クーポン。画像は 7 日で削除。</Li>
      </ul>
    ),
  },
  {
    scene: "night", kicker: "04 その夜", title: "思い出: コルクボードに、今日の一日", mascot: "lake",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>18:00 以降、会えた人・AR フォト・行った場所がコルクボードに貼られる。</Li>
        <Li>中身は保存せず、毎回記録から組み立てる。保存するのは一言日記と「行きたい」だけ。</Li>
        <Li>次の旅の提案 3 つ（別の季節に、また／別のイベント／まだ行っていない場所）。写真と人つき。「行きたい」でその場所が計画の候補に入る。</Li>
      </ul>
    ),
  },
  {
    scene: "after30", kicker: "05 30 日後", title: "便り: あの日の思い出と、行きたい場所が届く", mascot: "street",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>旅から 30 日。星凪諸島から便りが届く（リマインド）。</Li>
        <Li>あの日の写真・会った人・一言日記、そして「行きたい」と選んだ場所の写真。</Li>
        <Li>次の季節まで あと N 週間 — 種が花になる季節。そのまま計画の日決めへ。</Li>
      </ul>
    ),
  },
  {
    scene: "season", kicker: "06 次の季節", title: "花が咲く: 約束を果たし、また会いたくなる", mascot: "hall",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>季節が変わると種が花に。その人に会えた日に「約束を果たす」。咲いた花はひとめぐり帖に増える。</Li>
        <Li>関係は会えた別日数で はじめまして → また会えたね → おなじみ、おかえり。格付け・順位はつくらない。</Li>
        <Li>ひとめぐり帖は 8 人をカードで集める帖。全員に会うと完成。</Li>
        <Li>クーポンは当選の翌日から 1 年、同じ区分の店で。補填額は運営の窓で店ごとに集計。</Li>
      </ul>
    ),
  },
  {
    scene: "admin", kicker: "07 運営", title: "運営の窓: 指標・来訪予定・還元率・補填", mascot: "windmill",
    body: (m) => (
      <div>
        <ul style={{ paddingLeft: 20, marginTop: 0 }}>
          <Li>再訪率・訪問間隔・旅の後の起動率・満足なのに再訪なし・地区別消費・クーポン再訪・計画→来訪。3 人未満は出さない。</Li>
          <Li>来訪予定: 計画の日ごとに、何人がどこへ来るか。お店の人の準備に。</Li>
          <Li>CSV 取り込み（冪等・失敗行の理由）、還元率、抽選の商品、補填、変更履歴。</Li>
        </ul>
        {m && <MetricsGrid m={m} compact />}
      </div>
    ),
  },
  {
    kicker: "08 技術と正直な注記", title: "ローカルで完結、外部に頼らない", mascot: "lighthouse",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>FastAPI + SQLite + React/TS。1 プロセス、外部 API・CDN・外部フォントなし。入力検証・CSP・先頭バイト判定・SHA-256 重複・7 日削除。</Li>
        <Li>AR はカメラ映像にキャラクターを合成（マーカー認識なし）。AI-OCR はデモ演出（将来差し替え）。旅人の声は内部データ（本番は SNS 公式 API）。</Li>
        <Li>人の絵: Loose Drawing、風景: Unsplash、アイコン: ICOOON MONO、ほしまる: 自作。</Li>
        <Li>認証なし（ローカル前提）。本番では運営の窓に認証が必要。</Li>
      </ul>
    ),
  },
];

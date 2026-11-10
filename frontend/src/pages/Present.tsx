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
    scene: "pre", kicker: "人めぐり", title: "場所を選ぶと、人が付いてくる", mascot: "lighthouse",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>人を再訪させるのは、場所ではなく<b>人</b>。</Li>
        <Li>でも入口は場所のまま。選ぶのは場所だけで、人は「ここにいる人」として添える。</Li>
        <Li>出会いを記録し、思い出と次の約束を残す → もう一度その人に会いに行く理由ができる。</Li>
      </ul>
    ),
  },
  {
    scene: "pre", kicker: "01 旅前", title: "計画: 選ぶのは場所。人は添えるだけ", mascot: "cape",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>風景写真のカード 7 枚から、行きたい場所を選ぶ。</Li>
        <Li>カードの下に<b>「ここにいる人」</b>。人はまだ選ばせない。</Li>
        <Li>日を決めると、その日に会えそうな人が分かる。お店側にも来訪予定が届く。</Li>
      </ul>
    ),
  },
  {
    scene: "trip", kicker: "02 旅中", title: "マップ: 行った先で、人に会う", mascot: "market",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>場所に着いたら、そこにいる人に<b>「会えた」</b>。同じ日に同じ人は 1 回だけ。</Li>
        <Li>「会えた」を押すと、その人がひとめぐり帖に加わる。はじめまして（銅の帯）。</Li>
        <Li>その場所だけの AR フォトとレシートのポイントは、思い出と次の旅のクーポンに。</Li>
      </ul>
    ),
  },
  {
    scene: "night", kicker: "03 その夜", title: "思い出: 会えた人と、今日の一日が届く", mascot: "lake",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>18:00 以降、会えた人・AR フォト・行った場所が<b>おもいで便</b>に。</Li>
        <Li>旅の後にアプリを開く理由の 1 つ目。</Li>
        <Li>次の旅の提案に「行きたい」を押すと、その場所が計画の候補に入る。</Li>
      </ul>
    ),
  },
  {
    scene: "after30", kicker: "04 30 日後", title: "便り: あの日の人と、次の季節が届く", mascot: "street",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>旅から 30 日。あの日の写真・会った人・一言日記がもう一度届く。</Li>
        <Li>「次の季節まで あと N 週間」— 約束の季節が近いことを知らせる。</Li>
        <Li>そのまま、次の旅の日決めへ。</Li>
      </ul>
    ),
  },
  {
    scene: "season", kicker: "05 次の季節", title: "また会えたね: 約束を果たし、次の約束へ", mascot: "hall",
    body: () => (
      <ul style={{ paddingLeft: 20 }}>
        <Li>もう一度会うと、関係が はじめまして → <b>また会えたね</b> → おなじみ に。</Li>
        <Li>季節ごとの約束（その季節だけの一品・行事）が、次に行く理由になる。</Li>
        <Li>格付け・星・順位はつくらない。クーポンは次の旅でだけ使える。</Li>
      </ul>
    ),
  },
  {
    scene: "admin", kicker: "06 運営", title: "運営の窓: 指標・来訪予定・還元率・補填", mascot: "windmill",
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
    kicker: "07 技術と正直な注記", title: "ローカルで完結、外部に頼らない", mascot: "lighthouse",
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

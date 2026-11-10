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
        <div className="serif" style={{ fontWeight: 800, fontSize: "1.1rem", marginRight: 8 }}>ひとめぐり</div>
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
            <iframe ref={frame} src="/#/plan" title="ひとめぐり（本体）" style={{ width: "100%", height: "100%", border: 0, background: "#fff" }} />
          </div>
          <div className="muted small" style={{ textAlign: "center" }}>{curScene?.desc ?? ""}</div>
        </div>

        {/* 右: 16:9 のスライド（文字は大きく、本体と同じ高さに収める） */}
        <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 8, minHeight: 0 }}>
          <div style={{ display: "grid", placeItems: "center", minHeight: 0 }}>
            {/* スマホ幅のときは 16:9。PC 幅のときは右の列が細い（約 450px）ので、縦いっぱいのカードにして文字とマスコットを一段小さくする */}
            <div className="card slide" style={{ position: "relative", overflow: "hidden", width: "100%", maxWidth: 860, aspectRatio: wide ? undefined : "16 / 9", height: wide ? "100%" : undefined, padding: wide ? "16px 18px 14px" : "26px 30px", display: "flex", flexDirection: "column", boxSizing: "border-box", borderColor: "var(--ai-900)" }}>
              <div className="row between" style={{ alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="muted" style={{ letterSpacing: wide ? ".12em" : ".25em", fontSize: wide ? ".75rem" : ".9rem" }}>{S.kicker}</div>
                  <h1 className="serif" style={{ fontSize: wide ? "1.25rem" : "1.9rem", margin: wide ? "2px 0 8px" : "4px 0 10px", lineHeight: 1.3 }}>{S.title}</h1>
                </div>
                <Mascot k={S.mascot ?? "lighthouse"} size={wide ? 48 : 72} style={{ flex: "none" }} />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", fontSize: wide ? ".88rem" : "1.15rem", lineHeight: wide ? 1.5 : 1.6 }}>{S.body(metrics, wide)}</div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: "var(--ai-100)" }}>
                <div style={{ width: `${((slide + 1) / SLIDES.length) * 100}%`, height: "100%", background: "var(--yamabuki)" }} />
              </div>
            </div>
          </div>
          <div className="card row wrap" style={{ gap: 8, padding: 8, alignItems: "center" }}>
            <button className="btn ghost small" onClick={() => setSlide((x) => Math.max(0, x - 1))} disabled={slide === 0}>← 前</button>
            <span className="muted small" style={{ minWidth: 48, textAlign: "center" }}>{slide + 1} / {SLIDES.length}</span>
            <button className="btn ghost small" onClick={() => setSlide((x) => Math.min(SLIDES.length - 1, x + 1))} disabled={slide === SLIDES.length - 1}>次 →</button>
            {!wide && (
              <>
                <span style={{ width: 1, height: 24, background: "var(--ai-100)", margin: "0 4px" }} />
                <span className="muted small">本体を:</span>
                <button className="btn small ghost" onClick={() => tell("/wallet")}>クーポン</button>
                <button className="btn small ghost" onClick={() => tell("/book")}>帖</button>
                <button className="btn small ghost" onClick={() => tell(SCENE_PATH[cur] ?? "/")}>場面の画面へ</button>
              </>
            )}
            {adminMode && (
              <>
                {!wide && <span style={{ width: 1, height: 24, background: "var(--ai-100)", margin: "0 4px" }} />}
                <span className="muted small" style={wide ? { flexBasis: "100%", height: 0 } : undefined}>{wide ? "" : "運営の立場:"}</span>
                <button className="btn small ghost" onClick={() => setAdminRole("dmo")}>地域（DMO）</button>
                <button className="btn small ghost" onClick={() => setAdminRole("shop")}>お店・施設</button>
              </>
            )}
            {!wide && (
            <select value={st.fixed_prize ?? ""} style={{ width: 190, minHeight: 34, padding: 4, fontSize: ".85rem" }} onChange={async (e) => { await post("/demo/fix-lottery", { prize_id: e.target.value ? Number(e.target.value) : null }); await load(); }}>
              <option value="">次の抽選: 通常</option>
              {st.prizes.map((pz) => <option key={pz.id} value={pz.id}>抽選を固定: {pz.name}</option>)}
            </select>
            )}
            <button className="btn small ghost" style={{ marginLeft: "auto", borderColor: "var(--yamabuki)", color: "#7a5300" }} onClick={async () => { if (confirm("主人公の履歴を初期化して旅前に戻します。よろしいですか？")) { await post("/demo/reset"); setAdminMode(false); setWide(false); setSlide(0); await load(); tell("/plan"); } }}>初期化</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Li = ({ children }: { children: React.ReactNode }) => <li style={{ margin: "4px 0" }}>{children}</li>;

/** 場面スライドの型: 「いま左で見せていること」を番号つきの行で、下に「ねらい」を 1 行。PC 幅のときは見出しだけに縮める。 */
type Pt = { h: string; d: React.ReactNode };
function Points({ pts, aim, wide, side }: { pts: Pt[]; aim: React.ReactNode; wide: boolean; side?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: wide ? 6 : 10 }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 18, alignItems: "stretch" }}>
      <div style={{ flex: 1, minWidth: 0, display: "grid", alignContent: "space-evenly" }}>
        {pts.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: wide ? "1.6em 1fr" : "2.2em 1fr", alignItems: "baseline", padding: wide ? "3px 0" : "7px 0", borderTop: i ? "1px solid var(--ai-100)" : undefined }}>
            <div className="serif muted" style={{ fontSize: wide ? "1rem" : "1.35rem", fontWeight: 700 }}>{i + 1}</div>
            <div>
              <div className="serif" style={{ fontSize: wide ? "1rem" : "1.3rem", fontWeight: 800, lineHeight: 1.35 }}>{p.h}</div>
              <div className={wide ? "muted" : undefined} style={{ fontSize: wide ? ".8rem" : "1rem", lineHeight: 1.5, marginTop: 2 }}>{p.d}</div>
            </div>
          </div>
        ))}
      </div>
      {/* 右の余白に置く見本（スマホ幅のスライドのときだけ） */}
      {side && !wide && <div style={{ flex: "none", display: "grid", alignContent: "center" }}>{side}</div>}
      </div>
      <div style={{ background: "var(--ai-100)", borderRadius: 6, padding: wide ? "6px 10px" : "9px 14px", display: "flex", flexDirection: wide ? "column" : "row", gap: wide ? 2 : 12, alignItems: wide ? "flex-start" : "baseline", marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: ".8rem", fontWeight: 700, letterSpacing: ".15em", whiteSpace: "nowrap" }}>ねらい</span>
        <span style={{ fontSize: wide ? ".9rem" : "1.05rem", fontWeight: 700, lineHeight: 1.45 }}>{aim}</span>
      </div>
    </div>
  );
}

/** アンケートのお礼の見本: ほしまるの待ち受け・スタンプ・なかま証（img/gifts の実物を小さく並べる）。 */
function GiftSamples() {
  const frame: React.CSSProperties = { border: "1px solid var(--ai-100)", borderRadius: 8, background: "#fff", boxShadow: "0 3px 10px rgba(27,42,68,.12)", display: "block" };
  return (
    <div style={{ width: 196 }}>
      <div className="muted" style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".12em", marginBottom: 6, textAlign: "center" }}>アンケートのお礼（見本）</div>
      <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 10, alignItems: "center" }}>
        <figure style={{ margin: 0, gridRow: "1 / span 2" }}>
          <img src="/img/gifts/wallpapers/wp_autumn.png" alt="ほしまるの待ち受け（秋）" style={{ ...frame, width: 84, height: 182, objectFit: "cover", transform: "rotate(-3deg)" }} />
          <figcaption className="muted" style={{ fontSize: ".68rem", textAlign: "center", marginTop: 4 }}>待ち受け</figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          <img src="/img/gifts/stickers/st_thanks.png" alt="ほしまるのスタンプ" style={{ width: 96, height: 83, objectFit: "contain", display: "block", transform: "rotate(4deg)" }} />
          <figcaption className="muted" style={{ fontSize: ".68rem", textAlign: "center" }}>スタンプ</figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          <img src="/img/gifts/card/nakama.png" alt="星凪諸島なかま証" style={{ ...frame, width: 100, height: 63, objectFit: "cover", transform: "rotate(-2deg)" }} />
          <figcaption className="muted" style={{ fontSize: ".68rem", textAlign: "center", marginTop: 3 }}>なかま証</figcaption>
        </figure>
      </div>
    </div>
  );
}

const SLIDES: { scene?: string; kicker: string; title: string; mascot?: string; body: (m: Metrics | null, wide: boolean) => JSX.Element }[] = [
  {
    scene: "pre", kicker: "0 旅前 ｜ 計画", title: "写真で選ぶ。入口は場所のまま", mascot: "cape",
    body: (_m, wide) => (
      <Points wide={wide}
        pts={[
          { h: "写真を見て、直感で選ぶ", d: "風景写真のカードを見て、行きたい場所かどうかだけを決めます。" },
          { h: "あとから地図で直せる", d: "選んだ場所を地図に並べて、行き先と日取りを見直せます。" },
          { h: "人は「ここにいる人」として添える", d: "最初から人を目的地にするのは難しいので、選ぶのは場所だけです。" },
        ]}
        aim="旅のきっかけをつくる。人めぐりの入口は、場所のままでいい。" />
    ),
  },
  {
    scene: "trip", kicker: "1 旅中 ｜ マップ", title: "計画が地図になり、行った先で人に会う", mascot: "market",
    body: (_m, wide) => (
      <Points wide={wide}
        pts={[
          { h: "計画がそのまま地図になる", d: "立てた計画をマップに表示。今日どこへ行くかが一目でわかります。" },
          { h: "行った場所で、人と話す", d: "その場のやりとりを「会えた」のひと押しで記録します。" },
          { h: "AR フォトとレシートが思い出になる", d: "その場所で撮った写真と、そこで買ったものの記録が残ります。" },
        ]}
        aim="場所を訪ねるうちに、人との出会いが自然に残っていく。" />
    ),
  },
  {
    scene: "night", kicker: "2 その夜 ｜ 思い出", title: "一日を振り返り、「いい旅だった」と思える", mascot: "lake",
    body: (_m, wide) => (
      <Points wide={wide}
        pts={[
          { h: "めぐった場所が一覧で届く", d: "今日行った場所・会えた人・写真を、ひとまとめに振り返ります。" },
          { h: "感じたことを書き残す", d: "そのときの気持ちを一言で。あとから思い出す手がかりになります。" },
          { h: "次に行きたい場所を控えておく", d: "振り返りの中で気になった場所を、次の旅の候補に入れます。" },
          { h: "アンケートに答えると、待ち受け画像", d: "地域（DMO）とお店に声が届き、旅行者にはお礼が届きます。" },
        ]}
        side={<GiftSamples />}
        aim="旅の後にも、アプリを開く理由をつくる。" />
    ),
  },
  {
    scene: "after30", kicker: "3 30 日後 ｜ 便り", title: "旅を思い出し、もう一度行く計画へ", mascot: "street",
    body: (_m, wide) => (
      <Points wide={wide}
        pts={[
          { h: "前回の旅が、もう一度届く", d: "30 日後に、あの旅の内容をまとめて振り返れます。" },
          { h: "行った場所と会った人を、改めて確かめる", d: "写真と一言を見返すうちに、「また行きたい」が戻ってきます。" },
          { h: "そのまま次の計画へ", d: "振り返りの画面から、次の旅の計画づくりにつながります。" },
        ]}
        aim="思い出すことを、もう一度行くきっかけにする。" />
    ),
  },
  {
    scene: "season", kicker: "4 次の季節 ｜ 再訪", title: "また会うと、関係が育っていく", mascot: "hall",
    body: (_m, wide) => (
      <Points wide={wide}
        pts={[
          { h: "再会した人は、ステータスが上がる", d: <>はじめまして → <b>また会えたね</b> → おなじみ。会った回数で帯が変わります。</> },
          { h: "ひとめぐり帖が育つ", d: "会った人と回数が見えるようになり、全員に会うことを目指せます。" },
          { h: "レシートの金額に応じて、クーポン", d: "登録したレシートがポイントになり、次の旅で使えるクーポンに。" },
        ]}
        aim="2 回目、3 回目と通うほど、うれしいことが増える。" />
    ),
  },
  {
    scene: "admin", kicker: "5 運営 ｜ 運営の窓", title: "集めたデータを、次の一手につなげる", mascot: "windmill",
    body: (_m, wide) => (
      <Points wide={wide}
        pts={[
          { h: "管理画面は 2 種類", d: "地域（DMO）向けと、お店・施設（事業者）向けを用意しています。" },
          { h: "DMO: データから改善の手を打ちやすく", d: "再訪や消費の動きを見て、次に何をするかを決められます。" },
          { h: "事業者: お店の側から働きかける", d: "お店情報の編集に加え、会った旅行者へのメッセージやクーポン配布。" },
        ]}
        aim="旅行者を待つだけでなく、地域とお店からも再訪を後押しする。" />
    ),
  },
  {
    kicker: "補足 ｜ 技術と正直な注記", title: "ローカルで完結、外部に頼らない", mascot: "lighthouse",
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

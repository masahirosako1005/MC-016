import { useEffect, useMemo, useRef, useState } from "react";
import { get, post, sendForm, toast } from "../api";
import { useT } from "../i18n";
import { navigate, useRoute } from "../router";
import { TodoCard } from "../components/parts";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
import { Badge, Loading, TopBar } from "../components/ui";

type DrawResult = { hit: boolean; prize: { name: string; category: string }; balance: number; presenter: { id: number; name: string; role: string; shop_name: string; image: string; days: number } | null };
type Prize = { id: number; category: string; name: string; face_value: number; probability: number; in_stock: boolean; stock: number | null };
type Coupon = {
  id: number; category: string; name: string; face_value: number; won_on: string; valid_from: string; valid_until: string;
  used_on: string | null; used_shop_name: string | null; state: "usable" | "not_yet" | "used" | "expired";
};
type Receipt = { id: number; amount: number; rate_percent: number; points: number; received_on: string; shop_name: string; area: string; has_image: boolean; image_url: string | null };
type Wallet = {
  balance: number; points_per_draw: number; prizes: Prize[]; coupons: Coupon[]; receipts: Receipt[];
  shops: { id: number; name: string; category: string; rate_percent: number; person_name?: string }[];
  legacy_rewards: { reward_name: string; prize_name: string; got_at: string }[]; today: string;
};

export function WalletPage({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const route = useRoute();
  const [w, setW] = useState<Wallet | null>(null);
  const [showReceipt, setShowReceipt] = useState(route.query.get("receipt") === "1");
  const presetShop = Number(route.query.get("shop") || 0);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState<DrawResult | null>(null);
  const [help, setHelp] = useState(0);
  const drawRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const load = async () => setW(await get<Wallet>("/wallet"));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!w) return <div className="page"><Loading /></div>;
  const canDraw = w.balance >= w.points_per_draw;
  const usable = w.coupons.filter((c) => c.state === "usable");
  const draw = async () => {
    setDrawing(true);
    setResult(null);
    try {
      const [r] = await Promise.all([
        post<DrawResult>("/draws"),
        new Promise((res) => setTimeout(res, 450)),
      ]);
      // 結果は先に決まっている。スロットが止まってから見せる
      setPending(r);
    } catch (e) {
      setDrawing(false);
      toast((e as Error).message, "error");
    }
  };
  const settle = () => {
    if (!pending) return;
    setResult(pending);
    setPending(null);
    setDrawing(false);
    load();
    onChanged?.();
  };
  const todo = usable.length > 0
    ? { kind: "use", text: `使えるクーポンが ${usable.length} 枚。${usable[0].category}のお店で、お店の人の前で長押しして使います。`, button: null, path: null }
    : canDraw
      ? { kind: "draw", text: `${w.balance} pt たまっています。抽選で次の旅のクーポンを当てましょう。`, button: t("draw"), path: null }
      : { kind: "receipt", text: "お買いもののレシートを登録すると、ポイントがたまります。", button: t("receipt_button"), path: null };
  return (
    <div className="page">
      <Tutorial id="wallet" steps={TIPS.wallet} trigger={help} />
      <TopBar title={t("tab_wallet")} right={<HelpButton onClick={() => setHelp((n) => n + 1)} />} />
      <TodoCard todo={todo} onButton={() => { if (todo.kind === "draw") drawRef.current?.scrollIntoView({ behavior: "smooth" }); else { setShowReceipt(true); setTimeout(() => receiptRef.current?.scrollIntoView({ behavior: "smooth" }), 50); } }} />

      <h2>{t("coupons")}</h2>
      {w.coupons.length === 0 && <p className="muted">まだクーポンはありません。レシートでポイントをためて抽選すると、次の旅で使えるクーポンが当たります。</p>}
      <div className="stack">
        {w.coupons.map((c) => (
          <div key={c.id} className={`card ${c.state === "usable" ? "letter" : ""}`} style={{ opacity: c.state === "usable" || c.state === "not_yet" ? 1 : 0.6 }}>
            <div className="row between">
              <span className="title" style={{ fontSize: "1rem" }}>{c.name}</span>
              <Badge strong={c.state === "usable"} soft={c.state !== "usable"}>
                {c.state === "usable" ? "使える" : c.state === "not_yet" ? `${c.valid_from.replace(/-/g, "/")} から` : c.state === "used" ? "使用済み" : "期限切れ"}
              </Badge>
            </div>
            <div className="muted small">
              {c.category}のお店で使えます・期限 {c.valid_until.replace(/-/g, "/")}
              {c.used_on && `・${c.used_on.replace(/-/g, "/")} に ${c.used_shop_name ?? ""} で使用`}
            </div>
            {c.state === "usable" && (
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                {w.shops.filter((s) => s.category === c.category).map((s) => (
                  <button key={s.id} className="chip" onClick={() => navigate(`/shop/${s.id}`)}>{s.name}で使う</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2>{t("wallet_points")}と{t("draw")}</h2>
      <div ref={drawRef} className="card">
        <div className="row between">
          <div>
            <div className="muted small">{t("wallet_points")}</div>
            <div className="title" style={{ fontSize: "2rem" }}>{w.balance} <span style={{ fontSize: "1rem" }}>pt</span></div>
          </div>
          <div className="muted small" style={{ textAlign: "right" }}>{w.points_per_draw} pt で 1 回<br />クーポンは次の旅（翌日以降）から</div>
        </div>
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead><tr><th>当たるもの</th><th className="num">確率</th></tr></thead>
          <tbody>
            {w.prizes.map((p) => (
              <tr key={p.id} style={{ opacity: p.in_stock ? 1 : 0.5 }}>
                <td>{p.name}{!p.in_stock && <span className="muted small">（在庫なし）</span>}</td>
                <td className="num">{(p.probability * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Roulette prizes={w.prizes} target={pending?.prize.category ?? null} spinning={drawing} onDone={settle} />
        <button className={`btn block ${canDraw ? "primary mark" : "ghost"}`} style={{ marginTop: 10 }} disabled={!canDraw || drawing} onClick={draw}>
          {drawing ? "ドキドキ…" : canDraw ? `${t("draw")}（${w.points_per_draw} pt）` : `あと ${w.points_per_draw - w.balance} pt で抽選できます`}
        </button>
        {result && <ResultModal r={result} onClose={() => setResult(null)} />}
      </div>

      <h2>{t("receipts")}</h2>
      <div ref={receiptRef}>
        {!showReceipt ? (
          <button className="btn block" onClick={() => setShowReceipt(true)}>{t("receipt_button")}</button>
        ) : (
          <ReceiptForm
            shops={w.shops}
            preset={presetShop}
            onDone={async () => {
              setShowReceipt(false);
              await load();
              onChanged?.();
            }}
            onCancel={() => setShowReceipt(false)}
          />
        )}
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {w.receipts.map((r) => (
          <div key={r.id} className="card row">
            {r.image_url ? (
              <img src={r.image_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flex: "none" }} />
            ) : (
              <div className="muted" style={{ width: 56, height: 56, fontSize: "0.65rem", display: "flex", alignItems: "center", textAlign: "center", flex: "none" }}>画像は保存期間を過ぎました</div>
            )}
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{r.shop_name}</div>
              <div className="muted small">{r.received_on.replace(/-/g, "/")}・{r.amount.toLocaleString()} 円 × {r.rate_percent}% = {r.points} pt</div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">レシートの画像は 7 日で自動的に削除されます。金額などの記録は残ります。</p>

      {w.legacy_rewards.length > 0 && (
        <>
          <h2>以前の特典（参考）</h2>
          <div className="card">{w.legacy_rewards.map((l, i) => <div key={i} className="muted small">{l.got_at.slice(0, 10)} {l.prize_name}</div>)}</div>
        </>
      )}
    </div>
  );
}

function ReceiptForm({ shops, preset, onDone, onCancel }: { shops: Wallet["shops"]; preset: number; onDone: () => Promise<void>; onCancel: () => void }) {
  const [shopId, setShopId] = useState(shops.some((s) => s.id === preset) ? preset : shops[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shop = shops.find((s) => s.id === shopId);
  const amt = Number(amount);
  const pts = shop && amt > 0 ? Math.floor((amt * shop.rate_percent) / 100) : 0;
  const submit = async () => {
    if (!file) {
      toast("レシートの写真を撮ってください", "error");
      return;
    }
    if (!(amt >= 1 && amt <= 100000 && Number.isInteger(amt))) {
      toast("金額は 1〜100,000 円の整数で入れてください", "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("shop_id", String(shopId));
      fd.append("amount", String(amt));
      fd.append("image", file);
      const r = await sendForm<{ points: number; balance: number }>("/receipts", fd);
      toast(`${r.points} pt もらいました（合計 ${r.balance} pt）`);
      await onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack">
      <label className="field">
        <span>お店</span>
        <select value={shopId} onChange={(e) => setShopId(Number(e.target.value))}>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}{s.person_name ? `（${s.person_name}）` : ""}・還元 {s.rate_percent}%</option>)}
        </select>
      </label>
      <label className="field">
        <span>金額（円）</span>
        <input type="number" inputMode="numeric" min={1} max={100000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例: 1200" />
      </label>
      <div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className={`btn block ${file ? "done" : ""}`} onClick={() => fileRef.current?.click()}>
          {file ? `写真を選びました（${Math.round(file.size / 1024)} KB）` : "レシートの写真を撮る（必須）"}
        </button>
        <p className="muted small" style={{ margin: "4px 0 0" }}>PNG・JPEG・WebP、5MB まで。同じ写真は 2 回登録できません。きょうのレシートだけ登録できます。</p>
      </div>
      {pts > 0 && <div className="muted">もらえるポイント: {pts} pt</div>}
      <div className="row">
        <button className="btn ghost grow" onClick={onCancel}>やめる</button>
        <button className="btn primary grow mark" disabled={busy} onClick={submit}>登録する</button>
      </div>
    </div>
  );
}



const CAT_LABEL = (c: string) => (c === "miss" ? "はずれ" : c);

/** ルーレット演出。区分（飲食・宿泊・体験・物販・はずれ）を確率の大きさで分けた円盤が回り、上の矢印が止まった区分が結果。結果は API が先に決めている。 */
function Roulette({ prizes, target, spinning, onDone }: { prizes: Prize[]; target: string | null; spinning: boolean; onDone: () => void }) {
  const segs = useMemo(() => {
    const live = prizes.filter((p) => p.probability > 0);
    const total = live.reduce((n, p) => n + p.probability, 0) || 1;
    let acc = 0;
    return live.map((p, i) => {
      const start = (acc / total) * 360;
      acc += p.probability;
      const end = (acc / total) * 360;
      return { key: p.id, cat: p.category, label: CAT_LABEL(p.category), start, end, i };
    });
  }, [prizes]);
  const [rot, setRot] = useState(0);
  const [dur, setDur] = useState("transform .8s linear");
  const base = useRef(0);
  const doneRef = useRef(false);
  // 回りはじめ: 1 周ずつ送り、transitionend でさらに 1 周（CSS アニメーションだと最後の transition が始まらないため JS で回す）
  useEffect(() => {
    if (!spinning || target) return;
    doneRef.current = false;
    base.current += 360;
    setDur("transform .8s linear");
    setRot(base.current);
  }, [spinning, target]);
  useEffect(() => {
    if (!target) return;
    const seg = segs.find((x) => x.cat === target) ?? segs[0];
    if (!seg) return;
    const width = seg.end - seg.start;
    const inside = seg.start + width * (0.3 + 0.4 * ((Date.now() % 97) / 97)); // 区分の中のどこで止まるかは少し揺らす
    const cur = ((base.current % 360) + 360) % 360;
    const need = ((360 - inside) - cur + 360) % 360;
    const next = base.current + 360 * 4 + need;
    base.current = next;
    setDur("transform 3.2s cubic-bezier(.12,.8,.18,1)");
    setRot(next);
    // 念のため: transitionend が来なくても結果を出す
    const t = setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone(); } }, 3600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, segs]);
  const onEnd = () => {
    if (target) {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    } else if (spinning) {
      base.current += 360;
      setRot(base.current);
    }
  };
  const R = 120;
  const toXY = (deg: number, r: number) => [R + r * Math.sin((deg * Math.PI) / 180), R - r * Math.cos((deg * Math.PI) / 180)];
  const colors = ["#1b2a44", "#2f446a", "#56698f", "#3b5078"];
  return (
    <div className="roulette" aria-label={target ? "抽選の結果" : spinning ? "抽選中" : "ルーレット"}>
      <div className="pointer" aria-hidden="true" />
      <div className="wheelbox">
      <svg
        viewBox={`0 0 ${R * 2} ${R * 2}`}
        className="wheel"
        style={{ transform: `rotate(${rot}deg)`, transition: dur }}
        onTransitionEnd={onEnd}
      >
        {segs.map((sg) => {
          const [x1, y1] = toXY(sg.start, R - 4);
          const [x2, y2] = toXY(sg.end, R - 4);
          const large = sg.end - sg.start > 180 ? 1 : 0;
          const mid = (sg.start + sg.end) / 2;
          const [tx, ty] = toXY(mid, R * 0.62);
          const miss = sg.cat === "miss";
          return (
            <g key={sg.key}>
              <path d={`M${R} ${R} L${x1} ${y1} A${R - 4} ${R - 4} 0 ${large} 1 ${x2} ${y2} Z`} fill={miss ? "#e6eaf1" : colors[sg.i % colors.length]} stroke="#fbfcfd" strokeWidth="2" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={sg.end - sg.start < 28 ? 9 : 13} fontWeight="700" fill={miss ? "#56698f" : "#fbfcfd"} transform={`rotate(${mid} ${tx} ${ty})`} fontFamily="'Yu Mincho', serif">{sg.label}</text>
            </g>
          );
        })}
        <circle cx={R} cy={R} r={14} fill="#fbfcfd" stroke="#1b2a44" strokeWidth="2" />
        <circle cx={R} cy={R} r={4} fill="#e3a21a" />
      </svg>
      </div>
    </div>
  );
}

/** 結果のポップアップ。会ったことのある、その区分の店の人がいれば、その人が渡してくれる。いなければ ほしまる。 */
function ResultModal({ r, onClose }: { r: DrawResult; onClose: () => void }) {
  const p = r.presenter;
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label="抽選の結果" onClick={onClose}>
      <div className="modal slot-result" onClick={(e) => e.stopPropagation()}>
        {r.hit && p ? (
          <div style={{ position: "relative", width: 120, margin: "0 auto 6px" }}>
            <img src={p.image} alt={p.name} style={{ width: 120, height: 120, objectFit: "cover", objectPosition: "top", borderRadius: "50%", border: "3px solid var(--yamabuki)", background: "var(--ai-050)" }} />
            <img src="/img/mascot/ui/hoshimaru_coupon.png" alt="" width={56} height={56} style={{ position: "absolute", right: -16, bottom: -6 }} />
          </div>
        ) : (
          <img src={`/img/mascot/ui/hoshimaru_${r.hit ? "cheer" : "sorry"}.png`} alt="" width={110} height={110} style={{ display: "block", margin: "0 auto 4px" }} />
        )}
        <div className="title serif" style={{ fontSize: "1.6rem" }}>{r.hit ? "あたり！" : "ざんねん…"}</div>
        {r.hit && p ? (
          <p style={{ margin: "6px 0 2px" }}><b>{p.name}</b><span className="muted small">（{p.role}・{p.shop_name}）</span>から<br /><b>「{r.prize.name}」</b>をもらいました</p>
        ) : (
          <p style={{ margin: "6px 0 2px" }}>{r.hit ? <>ほしまるから<b>「{r.prize.name}」</b></> : r.prize.name}</p>
        )}
        <div className="muted small">{r.hit ? "次の旅（明日以降）から、同じ区分のお店で使えます" : "ポイントがたまったら、またどうぞ"}</div>
        {r.hit && p && <div className="muted small" style={{ marginTop: 4 }}>{p.name}とは {p.days} 日会えています。次の旅で、また。</div>}
        <button className="btn primary block mark" style={{ marginTop: 14 }} onClick={onClose}>とじる</button>
      </div>
    </div>
  );
}

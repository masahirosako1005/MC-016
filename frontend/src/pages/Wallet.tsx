import { useEffect, useRef, useState } from "react";
import { get, post, sendForm, toast } from "../api";
import { useT } from "../i18n";
import { navigate, useRoute } from "../router";
import { Badge, Loading, TopBar } from "../components/ui";

type Prize = { id: number; category: string; name: string; face_value: number; probability: number; in_stock: boolean; stock: number | null };
type Coupon = {
  id: number; category: string; name: string; face_value: number; won_on: string; valid_from: string; valid_until: string;
  used_on: string | null; used_shop_name: string | null; state: "usable" | "not_yet" | "used" | "expired";
};
type Receipt = { id: number; amount: number; rate_percent: number; points: number; received_on: string; shop_name: string; area: string; has_image: boolean; image_url: string | null };
type Wallet = {
  balance: number; points_per_draw: number; prizes: Prize[]; coupons: Coupon[]; receipts: Receipt[];
  shops: { id: number; name: string; category: string; rate_percent: number }[];
  legacy_rewards: { reward_name: string; prize_name: string; got_at: string }[]; today: string;
};

export function WalletPage({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const route = useRoute();
  const [w, setW] = useState<Wallet | null>(null);
  const [showReceipt, setShowReceipt] = useState(route.query.get("receipt") === "1");
  const [result, setResult] = useState<{ hit: boolean; prize: { name: string; category: string }; balance: number } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const load = async () => setW(await get<Wallet>("/wallet"));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!w) return <div className="page"><Loading /></div>;
  const canDraw = w.balance >= w.points_per_draw;
  const draw = async () => {
    setDrawing(true);
    setResult(null);
    try {
      const r = await post<{ hit: boolean; prize: { name: string; category: string }; balance: number }>("/draws");
      setTimeout(() => {
        setResult(r);
        setDrawing(false);
        load();
        onChanged?.();
      }, 900);
    } catch (e) {
      setDrawing(false);
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      <TopBar title={t("tab_wallet")} />
      <div className="card highlight">
        <div className="muted">{t("wallet_points")}</div>
        <div style={{ fontSize: "2rem", fontWeight: 800 }}>{w.balance} <span style={{ fontSize: "1rem" }}>pt</span></div>
        <div className="muted">{w.points_per_draw} pt で 1 回抽選できます</div>
      </div>

      <h2>{t("receipt_button")}</h2>
      {!showReceipt ? (
        <button className="btn primary block" onClick={() => setShowReceipt(true)}>{t("receipt_button")}</button>
      ) : (
        <ReceiptForm
          shops={w.shops}
          onDone={async () => {
            setShowReceipt(false);
            await load();
            onChanged?.();
          }}
          onCancel={() => setShowReceipt(false)}
        />
      )}

      <h2>{t("draw")}</h2>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>商品</th><th className="num">確率</th></tr></thead>
          <tbody>
            {w.prizes.map((p) => (
              <tr key={p.id} style={{ opacity: p.in_stock ? 1 : 0.5 }}>
                <td>{p.name}{!p.in_stock && <span className="muted">（在庫なし）</span>}</td>
                <td className="num">{(p.probability * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn primary block" style={{ marginTop: 10 }} disabled={!canDraw || drawing} onClick={draw}>
          {drawing ? "抽選中…" : canDraw ? `${t("draw")}（${w.points_per_draw} pt）` : `あと ${w.points_per_draw - w.balance} pt で抽選できます`}
        </button>
        {result && (
          <div className="card" style={{ marginTop: 10, textAlign: "center", borderColor: result.hit ? "var(--flower)" : "var(--line)" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{result.hit ? "あたり！" : "はずれ"}</div>
            <div>{result.prize.name}</div>
            {result.hit && <div className="muted">次の旅（明日以降）からクーポンとして使えます</div>}
          </div>
        )}
      </div>

      <h2>{t("coupons")}</h2>
      {w.coupons.length === 0 && <p className="muted">まだクーポンはありません。</p>}
      <div className="stack">
        {w.coupons.map((c) => (
          <div key={c.id} className="card" style={{ opacity: c.state === "usable" || c.state === "not_yet" ? 1 : 0.6 }}>
            <div className="row between">
              <span className="title">{c.name}</span>
              <Badge kind={c.state === "usable" ? "good" : c.state === "not_yet" ? "seed" : undefined}>
                {c.state === "usable" ? "使える" : c.state === "not_yet" ? `${c.valid_from.replace(/-/g, "/")} から` : c.state === "used" ? "使用済み" : "期限切れ"}
              </Badge>
            </div>
            <div className="muted">
              {c.category}のお店で使えます・期限 {c.valid_until.replace(/-/g, "/")}
              {c.used_on && `・${c.used_on.replace(/-/g, "/")} に ${c.used_shop_name ?? ""} で使用`}
            </div>
            {c.state === "usable" && <p className="muted" style={{ margin: "4px 0 0" }}>使うときは、お店のページで長押しします。</p>}
          </div>
        ))}
      </div>

      <h2>{t("receipts")}</h2>
      {w.receipts.length === 0 && <p className="muted">まだレシートはありません。</p>}
      <div className="stack">
        {w.receipts.map((r) => (
          <div key={r.id} className="card row">
            {r.image_url ? (
              <img src={r.image_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flex: "none" }} />
            ) : (
              <div className="muted" style={{ width: 56, height: 56, fontSize: "0.7rem", display: "flex", alignItems: "center", textAlign: "center", flex: "none" }}>画像は保存期間を過ぎました</div>
            )}
            <div className="grow">
              <div className="title">{r.shop_name}</div>
              <div className="muted">{r.received_on.replace(/-/g, "/")}・{r.amount.toLocaleString()} 円 × {r.rate_percent}% = {r.points} pt</div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">レシートの画像は 7 日で自動的に削除されます。金額などの記録は残ります。</p>

      {w.legacy_rewards.length > 0 && (
        <>
          <h2>スタンプラリーの特典（参考）</h2>
          <div className="card">{w.legacy_rewards.map((l, i) => <div key={i} className="muted">{l.got_at.slice(0, 10)} {l.prize_name}</div>)}</div>
        </>
      )}
      <button className="btn block ghost" style={{ marginTop: 12 }} onClick={() => navigate("/")}>きょうにもどる</button>
    </div>
  );
}

function ReceiptForm({ shops, onDone, onCancel }: { shops: Wallet["shops"]; onDone: () => Promise<void>; onCancel: () => void }) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? 0);
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
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}（還元 {s.rate_percent}%）</option>)}
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
        <p className="muted" style={{ margin: "4px 0 0" }}>PNG・JPEG・WebP、5MB まで。同じ写真は 2 回登録できません。きょうのレシートだけ登録できます。</p>
      </div>
      {pts > 0 && <div className="muted">もらえるポイント: {pts} pt</div>}
      <div className="row">
        <button className="btn ghost grow" onClick={onCancel}>やめる</button>
        <button className="btn primary grow" disabled={busy} onClick={submit}>登録する</button>
      </div>
    </div>
  );
}

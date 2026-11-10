/**
 * レシートを撮る画面。AR フォトと同じ流れ: 場所の画面のボタン → この画面でカメラ → すぐ下の「● 撮る」→
 * AI-OCR 風の読み取り演出 → 店と金額を確認して登録 → 場所の画面にもどる（記録はボタンの直下に並ぶ）。
 */
import { useEffect, useState } from "react";
import { get, sendForm, toast } from "../api";
import { navigate } from "../router";
import { CameraCapture } from "../components/capture";
import { Hoshimaru } from "../components/hoshimaru";
import { Badge, Loading, TopBar } from "../components/ui";
import type { PlaceCard } from "./Plan";

export function ReceiptPage({ placeId, onChanged }: { placeId: number; onChanged?: () => void }) {
  const [pl, setPl] = useState<PlaceCard | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"camera" | "scan" | "confirm" | "saving">("camera");
  const [shopId, setShopId] = useState(0);
  const [amount, setAmount] = useState("");
  const [demo, setDemo] = useState(false);
  const back = `/place/${placeId}`;
  useEffect(() => {
    get<PlaceCard>(`/places/${placeId}`)
      .then((p) => {
        setPl(p);
        setShopId(p.people[0]?.shop.id ?? 0);
      })
      .catch((e) => toast((e as Error).message, "error"));
    get<{ demo_mode: boolean }>("/health").then((h) => setDemo(h.demo_mode)).catch(() => undefined);
  }, [placeId]);
  if (!pl) return <div className="page"><Loading /></div>;
  const shops = pl.people.map((p) => p.shop);
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];
  const amt = Number(amount);
  const pts = shop && amt > 0 ? Math.floor((amt * (shop.rate_percent ?? 10)) / 100) : 0;
  const onFile = (f: File, objectUrl?: string) => {
    setFile(f);
    setUrl(objectUrl ?? URL.createObjectURL(f));
    setPhase("scan");
    setTimeout(() => {
      // デモ: 読み取り結果として金額の候補を出す（本番は AI-OCR の結果が入る）
      if (demo && !amount) setAmount("3000");
      setPhase("confirm");
    }, 1900);
  };
  const retake = () => {
    setFile(null);
    setUrl(null);
    setPhase("camera");
  };
  const submit = async () => {
    if (!file || !shop) return;
    if (!(amt >= 1 && amt <= 100000 && Number.isInteger(amt))) {
      toast("金額を 1〜100,000 円の整数で確認してください", "error");
      return;
    }
    setPhase("saving");
    try {
      const fd = new FormData();
      fd.append("shop_id", String(shop.id));
      fd.append("amount", String(amt));
      fd.append("image", file);
      const r = await sendForm<{ points: number; balance: number }>("/receipts", fd);
      toast(`${r.points} pt もらいました（合計 ${r.balance} pt）`);
      onChanged?.();
      navigate(back);
    } catch (e) {
      toast((e as Error).message, "error");
      setPhase("confirm");
    }
  };
  return (
    <div className="page" style={{ paddingBottom: "calc(var(--tab-h) + 16px)" }}>
      <TopBar title="レシートを撮る" backTo={back} right={<Hoshimaru pose="point" size={40} />} />
      {phase === "camera" && (
        <>
          <CameraCapture hint="レシート全体を枠に入れて「● 撮る」を押してください" onCapture={(f, u) => onFile(f, u)} onCancel={() => navigate(back)} />
          <p className="muted small" style={{ margin: "8px 0 0" }}>撮るだけで店名と金額を読み取ります（AI-OCR）。確認して登録するとポイントに。画像は 7 日で削除されます。</p>
        </>
      )}
      {url && phase !== "camera" && (
        <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#000" }}>
          <img src={url} alt="レシート" style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block", opacity: phase === "scan" ? 0.8 : 1 }} />
          {phase === "scan" ? (
            <>
              <div className="scanline" />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(27,42,68,.8)", color: "#fff", padding: "6px 10px", fontSize: ".85rem" }}>AI-OCR で読み取り中… 店名・金額・日付を探しています</div>
            </>
          ) : (
            <>
              <div className="ocr-box" style={{ left: "10%", top: "18%", width: "60%", height: "9%" }} />
              <div className="ocr-box" style={{ left: "45%", top: "62%", width: "45%", height: "10%", animationDelay: ".15s" }} />
            </>
          )}
        </div>
      )}
      {(phase === "confirm" || phase === "saving") && (
        <div className="card stack" style={{ marginTop: 10 }}>
          <div className="row between"><span className="small" style={{ fontWeight: 700 }}>読み取り結果{demo ? "（デモ）" : ""}</span><Badge flower>確認してください</Badge></div>
          <label className="field">
            <span>お店（この場所のお店）</span>
            <select value={shopId} onChange={(e) => setShopId(Number(e.target.value))}>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>金額（円）{demo && amount ? "・読み取り値" : ""}</span>
            <input type="number" inputMode="numeric" min={1} max={100000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="読み取れませんでした。入力してください" />
          </label>
          {pts > 0 && <div className="muted small">もらえるポイント: 約 {pts} pt</div>}
          <div className="row">
            <button className="btn ghost grow" onClick={retake}>撮り直す</button>
            <button className="btn primary grow mark" disabled={phase === "saving"} onClick={submit}>{phase === "saving" ? "登録中…" : "この内容で登録"}</button>
          </div>
        </div>
      )}
      <button className="btn ghost block small" style={{ marginTop: 10 }} onClick={() => navigate(back)}>{pl.name}にもどる</button>
    </div>
  );
}

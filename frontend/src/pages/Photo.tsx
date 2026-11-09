import { useEffect, useRef, useState } from "react";
import { get, toast } from "../api";
import { navigate } from "../router";
import { Badge, Loading, TopBar } from "../components/ui";

export type Photo = {
  id: number; kind: "person" | "spot"; title: string; subtitle: string; area: string; taken_on: string; season_label: string;
  url: string; is_sample: boolean; promise: { season_label: string; title: string; note: string } | null; share_text: string;
};

export function PhotoPage({ id }: { id: number }) {
  const [p, setP] = useState<Photo | null>(null);
  useEffect(() => {
    get<Photo>(`/photos/${id}`).then(setP).catch((e) => toast((e as Error).message, "error"));
  }, [id]);
  if (!p) return <div className="page"><Loading /></div>;
  const share = async () => {
    try {
      const res = await fetch(p.url);
      const blob = await res.blob();
      const file = new File([blob], `hitomeguri_${p.id}.png`, { type: blob.type });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({ files: [file], text: p.share_text });
      } else {
        await navigator.clipboard?.writeText(p.share_text);
        toast("この端末では共有シートが使えません。文をコピーしたので、ダウンロードした写真と一緒に投稿してください");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("共有できませんでした", "error");
    }
  };
  return (
    <div className="page">
      <TopBar title="AR フォト" backTo="/memories/book" />
      <img src={p.url} alt={p.title} style={{ width: "100%", borderRadius: 14, display: "block" }} />
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <span className="title">{p.title}</span>
        <Badge kind="seed">{p.season_label}</Badge>
        {p.is_sample && <Badge>サンプル</Badge>}
      </div>
      <div className="muted">{p.taken_on.replace(/-/g, "/")}・{p.subtitle}</div>
      {p.promise && <p>次の季節の約束: {p.promise.season_label}「{p.promise.title}」</p>}
      <div className="stack" style={{ marginTop: 12 }}>
        <a className="btn primary block" href={p.url} download={`hitomeguri_${p.id}${p.url.endsWith(".svg") ? ".svg" : ".png"}`}>
          写真をダウンロード
        </a>
        <button className="btn block" onClick={share}>共有する（SNS など）</button>
        <button className="btn block ghost" onClick={() => navigate(`/print/${p.id}`)}>印刷する（ハガキ判）</button>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>共有の文: {p.share_text}</p>
    </div>
  );
}

const CARD_W = 1000; // 100mm
const CARD_H = 1480; // 148mm

export function PrintPage({ id }: { id: number }) {
  const [p, setP] = useState<Photo | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    get<Photo>(`/photos/${id}/print`).then(setP).catch((e) => toast((e as Error).message, "error"));
  }, [id]);
  if (!p) return <div className="page"><Loading /></div>;

  const downloadPng = async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("画像を読み込めませんでした"));
        img.src = p.url;
      });
      const pad = 60;
      const boxW = CARD_W - pad * 2;
      const boxH = Math.round(boxW * (4 / 3));
      const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pad, pad, boxW, boxH, 24);
      ctx.clip();
      ctx.drawImage(img, pad + (boxW - dw) / 2, pad + (boxH - dh) / 2, dw, dh);
      ctx.restore();
      ctx.fillStyle = "#27323a";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText(p.title, pad, pad + boxH + 80);
      ctx.font = "30px sans-serif";
      ctx.fillStyle = "#2f5d62";
      ctx.fillText(`${p.taken_on.replace(/-/g, "/")}・${p.season_label}・${p.subtitle}`, pad, pad + boxH + 130);
      if (p.promise) {
        ctx.fillStyle = "#8a6d3b";
        ctx.fillText(`次の季節の約束: ${p.promise.season_label}「${p.promise.title}」`, pad, pad + boxH + 180);
      }
      ctx.fillStyle = "#6b7680";
      ctx.font = "26px sans-serif";
      ctx.fillText("ひとめぐり便 — 星凪諸島", pad, CARD_H - 50);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `hitomeguri_postcard_${p.id}.png`;
      a.click();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <TopBar title="印刷（ハガキ判 100×148mm）" backTo={`/photo/${p.id}`} />
      <style>{`
        @page { size: 100mm 148mm; margin: 0; }
        @media print { .postcard { width: 100mm; height: 148mm; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; } .page { padding: 0 !important; max-width: none !important; } }
      `}</style>
      <div className="noprint muted" style={{ marginBottom: 8 }}>観光案内所などの端末で印刷する想定です。PNG でも保存できます。</div>
      <div className="row noprint" style={{ marginBottom: 12 }}>
        <button className="btn primary grow" onClick={() => window.print()}>印刷する</button>
        <button className="btn grow" onClick={downloadPng}>PNG で保存</button>
      </div>
      <div
        ref={cardRef}
        className="postcard"
        style={{ width: "100%", aspectRatio: "100 / 148", background: "#fffdf7", borderRadius: 12, boxShadow: "0 2px 12px #0002", padding: "6%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ width: "100%", aspectRatio: "3 / 4", borderRadius: 12, overflow: "hidden", background: "#eee" }}>
          <img src={p.url} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{p.title}</div>
        <div style={{ color: "#2f5d62", fontSize: "0.9rem" }}>{p.taken_on.replace(/-/g, "/")}・{p.season_label}・{p.subtitle}</div>
        {p.promise && <div style={{ color: "#8a6d3b", fontSize: "0.9rem" }}>次の季節の約束: {p.promise.season_label}「{p.promise.title}」</div>}
        <div style={{ marginTop: "auto", color: "#6b7680", fontSize: "0.8rem" }}>ひとめぐり便 — 星凪諸島</div>
      </div>
    </div>
  );
}

/**
 * AR フォト。カメラ映像（なければ選んだ写真、なければその場所の風景写真）に、
 * その場所の「ほしまる」のフレーム（img/frames/）を重ねる。フレームなしのときは、場所のほしまるをドラッグで置ける。
 * マーカー認識はしない。合成は canvas: 背景 → ほしまる or フレーム PNG → 日付の札。保存後はその場所の画面にもどる。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { get, sendForm, toast } from "../api";
import { navigate, useRoute } from "../router";
import { Hoshimaru } from "../components/hoshimaru";
import { Loading, TopBar } from "../components/ui";

type FrameDef = { key: string; label: string; png: string | null; spot: boolean };
type Frame = {
  kind: "person"; id: number; unlocked: boolean; reason: string; title: string; subtitle: string; area: string; role: string;
  person_image: string; scene_image: string | null; place_name: string; date: string; season: string; season_label: string; spot_id: number;
  mascot: { key: string; name: string; about: string; pose: string; outfit: string; image: string } | null;
  frames: FrameDef[];
  promise: { season_label: string; title: string } | null;
};
type Source = "camera" | "file" | "scene";

const W = 900;
const H = 1200;

export function CameraPage({ kind, id }: { kind: string; id: number }) {
  const route = useRoute();
  const from = route.query.get("from");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.7 });
  const [big, setBig] = useState(false);
  const [frameKey, setFrameKey] = useState<string>("");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const backPath = from ? `/place/${from}` : frame ? `/place/${frame.spot_id}` : "/";

  useEffect(() => {
    get<Frame>(`/photos/frame/${kind}/${id}`)
      .then((f) => {
        setFrame(f);
        setFrameKey(f.frames[0]?.key ?? "none");
      })
      .catch((e) => toast((e as Error).message, "error"));
  }, [kind, id]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSource("scene");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      setSource("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      toast("カメラが使えないので、風景写真に合成します（写真を選ぶこともできます）");
      setSource("scene");
    }
  }, []);
  useEffect(() => {
    if (frame?.unlocked) startCamera();
    return stopCamera;
  }, [frame?.unlocked, startCamera, stopCamera]);
  useEffect(() => {
    const on = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      const b = e.beta ?? 0;
      setTilt({ x: Math.max(-1, Math.min(1, g / 30)), y: Math.max(-1, Math.min(1, (b - 45) / 30)) });
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, []);

  if (!frame) return <div className="page"><Loading /></div>;
  if (!frame.unlocked) {
    return (
      <div className="page">
        <TopBar title="AR フォト" backTo={backPath} />
        <div className="card row">
          <Hoshimaru pose="sorry" size={64} />
          <div className="grow">
            <div className="title">{frame.title}</div>
            <p style={{ margin: "4px 0 0" }}>{frame.reason}</p>
            <p className="muted small">その場で、その人に会えた日だけ撮れる一枚です。</p>
          </div>
        </div>
      </div>
    );
  }
  const mascot = frame.mascot;
  const sel = frame.frames.find((f) => f.key === frameKey) ?? frame.frames[0];
  const useFrame = !!sel?.png;
  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || useFrame) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)), y: Math.min(0.95, Math.max(0.1, (e.clientY - r.top) / r.height)) });
  };
  const px = pos.x + tilt.x * 0.02;
  const py = pos.y + tilt.y * 0.02;
  const size = big ? 0.62 : 0.46;

  const capture = async () => {
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      if (source === "camera" && videoRef.current && videoRef.current.videoWidth > 0) {
        drawCover(ctx, videoRef.current, videoRef.current.videoWidth, videoRef.current.videoHeight);
      } else if (source === "file" && fileUrl) {
        const img = await loadImage(fileUrl);
        drawCover(ctx, img, img.naturalWidth, img.naturalHeight);
      } else if (frame.scene_image) {
        const img = await loadImage(frame.scene_image);
        drawCover(ctx, img, img.naturalWidth, img.naturalHeight);
      } else {
        ctx.fillStyle = "#e6eaf1";
        ctx.fillRect(0, 0, W, H);
      }
      if (useFrame && sel?.png) {
        const fr = await loadImage(sel.png);
        ctx.drawImage(fr, 0, 0, W, H);
      } else if (mascot) {
        const r = size * W;
        const base = await loadImage(mascot.image);
        ctx.drawImage(base, px * W - r / 2, py * H - r / 2, r, r);
      }
      if (overlayRef.current) {
        const ov = await svgToImage(overlayRef.current, W, H);
        ctx.drawImage(ov, 0, 0, W, H);
      }
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("画像を作れませんでした"))), "image/png"));
      const fd = new FormData();
      fd.append("kind", "person");
      fd.append("target_id", String(frame.id));
      fd.append("image", blob, "ar.png");
      const saved = await sendForm<{ id: number }>("/photos", fd);
      stopCamera();
      toast("保存しました");
      navigate(`/photo/${saved.id}?from=${from ?? frame.spot_id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: "calc(var(--tab-h) + 16px)" }}>
      <TopBar title={`AR フォト・${frame.place_name}`} backTo={backPath} right={<Hoshimaru pose="camera" size={40} />} />
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", background: "var(--ai-900)", borderRadius: 8, overflow: "hidden", touchAction: "none" }}
        onPointerDown={(e) => { dragging.current = true; onPointer(e); }}
        onPointerMove={onPointer}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {source === "camera" && <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {source === "file" && fileUrl && <img src={fileUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {(source === "scene" || source === null) && frame.scene_image && <img src={frame.scene_image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {useFrame && sel?.png && <img src={sel.png} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />}
        {!useFrame && mascot && (
          <img src={mascot.image} alt={mascot.name} draggable={false} style={{ position: "absolute", left: `${px * 100}%`, top: `${py * 100}%`, width: `${size * 100}%`, transform: "translate(-50%, -50%)", pointerEvents: "none", filter: "drop-shadow(0 3px 6px rgba(0,0,0,.35))" }} />
        )}
        <Overlay ref={overlayRef} frame={frame} compact={useFrame} />
        {source === null && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", background: "#0006" }}>カメラを準備中…</div>}
      </div>
      {/* シャッターは映像のすぐ下。フレームはその下に横スクロールで */}
      <div className="row" style={{ marginTop: 8, alignItems: "stretch" }}>
        <button className="btn ghost small" style={{ flex: "none" }} onClick={() => fileRef.current?.click()} aria-label="写真を選ぶ">写真を<br />選ぶ</button>
        <button className="btn primary grow mark" style={{ minHeight: 56, fontSize: "1.1rem" }} disabled={busy || source === null} onClick={capture}>{busy ? "保存中…" : "● 撮る"}</button>
        {source !== "camera" ? (
          <button className="btn ghost small" style={{ flex: "none" }} onClick={startCamera}>カメラ</button>
        ) : (
          <button className="btn ghost small" style={{ flex: "none" }} onClick={() => { stopCamera(); setSource("scene"); }}>風景で<br />撮る</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; stopCamera(); setFileUrl(URL.createObjectURL(f)); setSource("file"); }} />
      <div className="muted small" style={{ margin: "10px 0 2px" }}>フレームをえらぶ（★はこの場所だけ）</div>
      <div className="hscroll">
        {frame.frames.map((f) => (
          <button key={f.key} className={`chip ${frameKey === f.key ? "on" : ""}`} onClick={() => setFrameKey(f.key)}>{f.spot ? "★ " : ""}{f.label}</button>
        ))}
        {!useFrame && <button className="chip" onClick={() => setBig((b) => !b)}>{big ? "ほしまるを小さく" : "ほしまるを大きく"}</button>}
      </div>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>
        {useFrame ? `${sel?.label}。` : mascot ? `${mascot.name} — ${mascot.about} ドラッグで動かせます。` : ""}
        {source === "scene" ? `いまは${frame.place_name}の風景写真に合成しています。` : ""}
      </p>
      <button className="btn ghost block small" style={{ marginTop: 8 }} onClick={() => { stopCamera(); navigate(backPath); }}>{frame.place_name}にもどる</button>
    </div>
  );
}

import { forwardRef } from "react";
const Overlay = forwardRef<SVGSVGElement, { frame: Frame; compact: boolean }>(function Overlay({ frame, compact }, ref) {
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {compact ? (
        <g>
          <rect x="40" y="52" width="430" height="56" rx="8" fill="#fbfcfd" opacity=".88" />
          <rect x="40" y="52" width="8" height="56" fill="#1b2a44" />
          <text x="64" y="90" fontSize="24" fontFamily="'Yu Gothic UI', sans-serif" fill="#1b2a44" fontWeight="700">{frame.date.replace(/-/g, "/")}・{frame.season_label}・{frame.title}と</text>
        </g>
      ) : (
        <g>
          <rect x="40" y="40" width={W - 80} height="124" rx="8" fill="#fbfcfd" opacity=".9" />
          <rect x="40" y="40" width="8" height="124" fill="#1b2a44" />
          <text x="72" y="92" fontSize="40" fontFamily="'Yu Mincho', serif" fontWeight="700" fill="#1b2a44">{frame.place_name}</text>
          <text x="72" y="140" fontSize="28" fontFamily="'Yu Gothic UI', sans-serif" fill="#2f446a">{frame.date.replace(/-/g, "/")}・{frame.season_label}・{frame.title}と</text>
          <text x={W - 60} y={H - 50} fontSize="26" fontFamily="sans-serif" textAnchor="end" fill="#fbfcfd" stroke="#1b2a4466" strokeWidth="1">#ひとめぐり便 #星凪諸島 #ほしまる</text>
        </g>
      )}
    </svg>
  );
});

function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number) {
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("画像を読み込めませんでした"));
    img.src = url;
  });
}
async function svgToImage(svg: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.removeAttribute("style");
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * AR フォト。カメラ映像（なければ選んだ写真、なければその場所の風景写真）の上に、
 * その人の絵・季節のモチーフ・日付と場所を重ね、端末の傾きで飾りが少し動く。マーカー認識はしない。
 * 合成は canvas で行い PNG を保存する。
 */
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { get, sendForm, toast } from "../api";
import { navigate } from "../router";
import { Loading, TopBar } from "../components/ui";

type Frame = {
  kind: "person"; id: number; unlocked: boolean; reason: string; title: string; subtitle: string; area: string; role: string;
  person_image: string; scene_image: string | null; place_name: string; date: string; season: string; season_label: string;
  promise: { season_label: string; title: string } | null;
};
type Source = "camera" | "file" | "scene";

const W = 900;
const H = 1200;

export function CameraPage({ kind, id }: { kind: string; id: number }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.66 });
  const [big, setBig] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    get<Frame>(`/photos/frame/${kind}/${id}`).then(setFrame).catch((e) => toast((e as Error).message, "error"));
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
        <TopBar title="AR フォト" backTo="/" />
        <div className="card">
          <div className="title">{frame.title}</div>
          <p>{frame.reason}</p>
          <p className="muted">その場で、その人に会えた日だけ撮れる一枚です。</p>
        </div>
      </div>
    );
  }

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)), y: Math.min(0.95, Math.max(0.1, (e.clientY - r.top) / r.height)) });
  };

  const px = pos.x + tilt.x * 0.02;
  const py = pos.y + tilt.y * 0.02;
  const size = big ? 0.5 : 0.36;

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
        ctx.fillStyle = "rgba(27,42,68,0.18)";
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = "#e6eaf1";
        ctx.fillRect(0, 0, W, H);
      }
      // 人の絵（PNG）を直接描く
      const person = await loadImage(frame.person_image);
      const r = size * W;
      ctx.drawImage(person, px * W - r / 2, py * H - r / 2, r, r);
      // 飾りと文字（SVG）
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
      navigate(`/photo/${saved.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: "calc(var(--tab-h) + 16px)" }}>
      <TopBar title={`AR フォト・${frame.title}`} backTo="/" />
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", background: "var(--ai-900)", borderRadius: 8, overflow: "hidden", touchAction: "none" }}
        onPointerDown={(e) => {
          dragging.current = true;
          onPointer(e);
        }}
        onPointerMove={onPointer}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {source === "camera" && <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {source === "file" && fileUrl && <img src={fileUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {(source === "scene" || source === null) && frame.scene_image && (
          <>
            <img src={frame.scene_image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(27,42,68,0.18)" }} />
          </>
        )}
        <img
          src={frame.person_image}
          alt={frame.title}
          draggable={false}
          style={{ position: "absolute", left: `${px * 100}%`, top: `${py * 100}%`, width: `${size * 100}%`, transform: "translate(-50%, -50%)", pointerEvents: "none", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.35))" }}
        />
        <Overlay ref={overlayRef} frame={frame} px={px} py={py} />
        {source === null && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", background: "#0006" }}>カメラを準備中…</div>}
      </div>
      <p className="muted small" style={{ margin: "6px 0" }}>
        {frame.title}の絵はドラッグで動かせます。{source === "camera" ? "端末を傾けると飾りが少し動きます。" : source === "scene" ? `いまは${frame.place_name}の風景写真に合成しています。` : ""}
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small ghost grow" onClick={() => setBig((b) => !b)}>{big ? "小さく" : "大きく"}</button>
        <button className="btn small ghost grow" onClick={() => fileRef.current?.click()}>写真を選ぶ</button>
        <button className="btn small ghost grow" onClick={() => { stopCamera(); setSource("scene"); }}>風景で撮る</button>
        {source !== "camera" && <button className="btn small ghost grow" onClick={startCamera}>カメラ</button>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          stopCamera();
          setFileUrl(URL.createObjectURL(f));
          setSource("file");
        }}
      />
      <button className="btn primary block mark" disabled={busy || source === null} onClick={capture}>
        {busy ? "保存中…" : "撮る"}
      </button>
    </div>
  );
}

const Overlay = forwardRef<SVGSVGElement, { frame: Frame; px: number; py: number }>(function Overlay({ frame, px, py }, ref) {
  const motifs = SEASON_MOTIFS[frame.season] ?? SEASON_MOTIFS.autumn;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {motifs.map((m, i) => (
        <g key={i} transform={`translate(${m.x + (px - 0.5) * 60} ${m.y + (py - 0.5) * 40})`} opacity=".9">
          {m.shape}
        </g>
      ))}
      <rect x="40" y="40" width={W - 80} height="124" rx="8" fill="#fbfcfd" opacity=".9" />
      <rect x="40" y="40" width="8" height="124" fill="#1b2a44" />
      <text x="72" y="92" fontSize="40" fontFamily="'Yu Mincho', serif" fontWeight="700" fill="#1b2a44">{frame.title}</text>
      <text x="72" y="140" fontSize="28" fontFamily="'Yu Gothic UI', sans-serif" fill="#2f446a">
        {frame.date.replace(/-/g, "/")}・{frame.season_label}・{frame.place_name}
      </text>
      <text x={W - 60} y={H - 50} fontSize="26" fontFamily="sans-serif" textAnchor="end" fill="#fbfcfd" stroke="#1b2a4466" strokeWidth="1">#ひとめぐり便 #星凪諸島</text>
    </svg>
  );
});

const SEASON_MOTIFS: Record<string, { x: number; y: number; shape: JSX.Element }[]> = {
  autumn: [
    { x: 120, y: 260, shape: <path d="M0 0 q20 -30 40 0 q-20 30 -40 0z" fill="#e3a21a" /> },
    { x: 760, y: 320, shape: <path d="M0 0 q20 -30 40 0 q-20 30 -40 0z" fill="#fbfcfd" opacity=".85" /> },
    { x: 200, y: 520, shape: <path d="M0 0 q20 -30 40 0 q-20 30 -40 0z" fill="#e3a21a" opacity=".8" /> },
  ],
  winter: [
    { x: 150, y: 260, shape: <path d="M0 -20 V20 M-20 0 H20 M-14 -14 L14 14 M-14 14 L14 -14" stroke="#fbfcfd" strokeWidth="4" /> },
    { x: 740, y: 340, shape: <path d="M0 -20 V20 M-20 0 H20 M-14 -14 L14 14 M-14 14 L14 -14" stroke="#fbfcfd" strokeWidth="4" /> },
    { x: 220, y: 560, shape: <circle r="10" fill="#fbfcfd" /> },
  ],
  spring: [
    { x: 150, y: 260, shape: <g>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cy="-14" rx="8" ry="14" fill="#fbfcfd" opacity=".9" transform={`rotate(${a})`} />)}</g> },
    { x: 760, y: 340, shape: <g>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cy="-14" rx="8" ry="14" fill="#e3a21a" opacity=".85" transform={`rotate(${a})`} />)}</g> },
  ],
  summer: [
    { x: 150, y: 260, shape: <circle r="26" fill="#e3a21a" /> },
    { x: 760, y: 360, shape: <path d="M-30 0 q15 -20 30 0 t30 0" stroke="#fbfcfd" strokeWidth="5" fill="none" /> },
  ],
};

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

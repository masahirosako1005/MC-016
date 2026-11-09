/** カメラで撮る（AR フォトと同じ getUserMedia）。カメラが使えなければ写真を選ぶ。結果は PNG/JPEG の Blob。 */
import { useCallback, useEffect, useRef, useState } from "react";

export function CameraCapture({ onCapture, onCancel, hint }: { onCapture: (file: File, url: string) => void; onCancel?: () => void; hint?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "live" | "nocam">("starting");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("nocam");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
      streamRef.current = s;
      setState("live");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setState("nocam");
    }
  }, []);
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
    if (!blob) return;
    stop();
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file, URL.createObjectURL(file));
  };
  return (
    <div className="stack">
      <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", background: "var(--ai-900)", borderRadius: 8, overflow: "hidden" }}>
        {state === "live" && <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {state === "starting" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}>カメラを準備中…</div>}
        {state === "nocam" && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", padding: 20, textAlign: "center" }}>
            <div>
              カメラが使えません。<br />
              <button className="btn small" style={{ marginTop: 10, background: "#fff" }} onClick={() => fileRef.current?.click()}>写真を選ぶ</button>
            </div>
          </div>
        )}
        {state === "live" && (
          <div style={{ position: "absolute", left: "8%", right: "8%", top: "12%", bottom: "12%", border: "2px dashed rgba(255,255,255,.7)", borderRadius: 8, pointerEvents: "none" }} />
        )}
        {hint && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(27,42,68,.7)", color: "#fff", padding: "6px 10px", fontSize: ".85rem" }}>{hint}</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { stop(); onCapture(f, URL.createObjectURL(f)); } }} />
      <div className="row">
        {onCancel && <button className="btn ghost grow" onClick={() => { stop(); onCancel(); }}>やめる</button>}
        <button className="btn ghost small" onClick={() => fileRef.current?.click()}>写真を選ぶ</button>
        <button className="btn primary grow mark" disabled={state !== "live"} onClick={shoot}>シャッター</button>
      </div>
    </div>
  );
}

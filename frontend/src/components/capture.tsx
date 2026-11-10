/** カメラで撮る（AR フォトと同じ getUserMedia）。カメラが使えなければ写真を選ぶ。結果は PNG/JPEG の Blob。
 * 左右反転: 内カメラ（PC のカメラなど）はそのままだと文字が鏡文字に見えるので、反転して映す（保存する画像も同じ向き）。 */
import { useCallback, useEffect, useRef, useState } from "react";

export function CameraCapture({ onCapture, onCancel, hint, mirrorDefault }: { onCapture: (file: File, url: string) => void; onCancel?: () => void; hint?: string; mirrorDefault?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "live" | "nocam">("starting");
  const [mirror, setMirror] = useState(!!mirrorDefault);

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
      // 外カメラが取れなかった（内カメラ）ときは最初から反転する
      const facing = s.getVideoTracks()[0]?.getSettings?.().facingMode;
      if (mirrorDefault === undefined) setMirror(facing !== "environment");
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
  }, [mirrorDefault]);
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
    const ctx = c.getContext("2d")!;
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
    if (!blob) return;
    stop();
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file, URL.createObjectURL(file));
  };
  return (
    <div className="stack">
      <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", background: "var(--ai-900)", borderRadius: 8, overflow: "hidden" }}>
        {state === "live" && <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : undefined }} />}
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
          <>
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "12%", bottom: "12%", border: "2px dashed rgba(255,255,255,.7)", borderRadius: 8, pointerEvents: "none" }} />
            <button type="button" className={`chip ${mirror ? "on" : ""}`} style={{ position: "absolute", right: 8, top: 8, minHeight: 32, fontSize: ".8rem", opacity: .95 }} onClick={() => setMirror((m) => !m)} aria-pressed={mirror}>
              ⇄ 左右反転{mirror ? " 中" : ""}
            </button>
          </>
        )}
        {hint && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(27,42,68,.6)", color: "#fff", padding: "6px 10px", fontSize: ".85rem" }}>{hint}</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { stop(); onCapture(f, URL.createObjectURL(f)); } }} />
      {/* AR フォトと同じ並び: 左に「写真を選ぶ」、まん中に大きな「撮る」、右に「やめる」 */}
      <div className="row" style={{ alignItems: "stretch" }}>
        <button className="btn ghost small" style={{ flex: "none" }} onClick={() => fileRef.current?.click()} aria-label="写真を選ぶ">写真を<br />選ぶ</button>
        <button className="btn primary grow mark" style={{ minHeight: 56, fontSize: "1.1rem" }} disabled={state !== "live"} onClick={shoot}>● 撮る</button>
        {onCancel && <button className="btn ghost small" style={{ flex: "none" }} onClick={() => { stop(); onCancel(); }}>やめる</button>}
      </div>
      {state === "live" && <div className="muted small">文字が鏡文字に見えるときは「左右反転」を押してください。保存される画像も同じ向きになります。</div>}
    </div>
  );
}

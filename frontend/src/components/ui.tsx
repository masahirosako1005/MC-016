import { useEffect, useRef, useState, type ReactNode } from "react";
import { onToast } from "../api";
import { navigate } from "../router";
import { useT } from "../i18n";

export function Toasts() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: "error" | "info" }[]>([]);
  useEffect(
    () =>
      onToast((msg, kind) => {
        const id = Date.now() + Math.random();
        setItems((xs) => [...xs, { id, msg, kind }]);
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
      }),
    [],
  );
  return (
    <>
      {items.map((t, i) => (
        <div key={t.id} className={`toast ${t.kind}`} style={{ bottom: `calc(var(--tab-h) + ${16 + i * 52}px)` }} role="status">
          {t.msg}
        </div>
      ))}
    </>
  );
}

export function Badge({ strong, soft, flower, kind, children }: { strong?: boolean; soft?: boolean; flower?: boolean; kind?: "good" | "warn" | "seed" | "flower"; children: ReactNode }) {
  const s = strong || kind === "good" || kind === "warn";
  const f = flower || kind === "flower";
  const so = soft || kind === "seed";
  return <span className={`badge ${s ? "strong" : ""} ${so && !s ? "soft" : ""} ${f ? "flower" : ""}`}>{children}</span>;
}

export function TopBar({ title, right, backTo }: { title: ReactNode; right?: ReactNode; backTo?: string }) {
  const t = useT();
  return (
    <div className="topbar">
      <div className="row">
        {backTo !== undefined && (
          <button className="iconbtn" aria-label={t("back")} onClick={() => navigate(backTo)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className="date">{title}</div>
      </div>
      <div className="row">{right}</div>
    </div>
  );
}

/** 1.2 秒の長押しボタン。途中で離すと取り消し。 */
export function LongPressButton({ onComplete, children, className = "", disabled, ms = 1200 }: { onComplete: () => void; children: ReactNode; className?: string; disabled?: boolean; ms?: number }) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<number | null>(null);
  const start = () => {
    if (disabled) return;
    setPressing(true);
    timer.current = window.setTimeout(() => {
      setPressing(false);
      timer.current = null;
      onComplete();
    }, ms);
  };
  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setPressing(false);
  };
  return (
    <button className={`btn longpress ${pressing ? "pressing" : ""} ${className}`} disabled={disabled} onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}>
      <span className="fill" />
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}

export function Loading() {
  const t = useT();
  return <p className="muted">{t("loading")}</p>;
}

export function Icon({ name, size = 24, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return <img src={`/img/icons/${name}.svg`} alt="" width={size} height={size} style={style} aria-hidden="true" />;
}

export function SettingsIcon() {
  return <Icon name="settings" size={24} style={{ opacity: 0.8 }} />;
}

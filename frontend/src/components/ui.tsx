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

export function Badge({ kind, children }: { kind?: "warn" | "good" | "seed" | "flower"; children: ReactNode }) {
  return <span className={`badge ${kind ?? ""}`}>{children}</span>;
}

export function TopBar({ title, right, backTo }: { title: ReactNode; right?: ReactNode; backTo?: string }) {
  const t = useT();
  return (
    <div className="topbar">
      <div className="row">
        {backTo !== undefined && (
          <button className="iconbtn" aria-label={t("back")} onClick={() => navigate(backTo)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
export function LongPressButton({
  onComplete,
  children,
  className = "",
  disabled,
  ms = 1200,
}: {
  onComplete: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  ms?: number;
}) {
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
    <button
      className={`btn longpress ${pressing ? "pressing" : ""} ${className}`}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="fill" />
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}

export function Loading() {
  const t = useT();
  return <p className="muted">{t("loading")}</p>;
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}

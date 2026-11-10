/** 運営の窓のサブナビ。機能ごとに画面を分け、スマホでも横スクロールで選べる。選んだタブは sessionStorage に残す。 */
import { useState } from "react";

export type NavItem = { key: string; label: string };

export function useSubTab(storageKey: string, initial: string): [string, (k: string) => void] {
  const [tab, setTab] = useState<string>(() => {
    try {
      return sessionStorage.getItem(storageKey) || initial;
    } catch {
      return initial;
    }
  });
  const pick = (k: string) => {
    setTab(k);
    try {
      sessionStorage.setItem(storageKey, k);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [tab, pick];
}

export type NavItemX = NavItem & { icon?: string; desc?: string };

/** 下線つきのタブ。選ばれているタブは太字 + 山吹の下線。下に「いまの場所」の行を出して、どの画面か分かるようにする。 */
export function SubNav({ items, value, onChange, crumb }: { items: NavItemX[]; value: string; onChange: (k: string) => void; crumb?: string }) {
  const cur = items.find((i) => i.key === value);
  return (
    <div className="tabwrap">
      <nav className="fntabs" aria-label="機能" role="tablist">
        {items.map((it) => (
          <button key={it.key} role="tab" className={value === it.key ? "on" : ""} aria-selected={value === it.key} onClick={() => onChange(it.key)}>
            {it.icon && <span className="ico" aria-hidden="true">{it.icon}</span>}
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      {cur && (
        <div className="crumb">
          <span className="muted small">{crumb ? `${crumb} › ` : ""}</span><b>{cur.label}</b>
        </div>
      )}
    </div>
  );
}

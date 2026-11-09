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

export function SubNav({ items, value, onChange }: { items: NavItem[]; value: string; onChange: (k: string) => void }) {
  return (
    <nav className="subnav" aria-label="機能">
      {items.map((it) => (
        <button key={it.key} className={value === it.key ? "on" : ""} aria-current={value === it.key ? "page" : undefined} onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </nav>
  );
}

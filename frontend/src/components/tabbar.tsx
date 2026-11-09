import { navigate } from "../router";
import { useT } from "../i18n";

const ICONS = {
  explore: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </svg>
  ),
  memories: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </svg>
  ),
};

export function TabBar({ active, letterBadge }: { active: string; letterBadge?: boolean }) {
  const t = useT();
  const tabs: { key: keyof typeof ICONS; path: string; label: string }[] = [
    { key: "explore", path: "/explore", label: t("tab_explore") },
    { key: "today", path: "/", label: t("tab_today") },
    { key: "memories", path: "/memories", label: t("tab_memories") },
    { key: "wallet", path: "/wallet", label: t("tab_wallet") },
  ];
  return (
    <nav className="tabbar" aria-label="メイン">
      {tabs.map((tb) => (
        <button key={tb.key} className={active === tb.key ? "on" : ""} onClick={() => navigate(tb.path)} aria-current={active === tb.key ? "page" : undefined}>
          {ICONS[tb.key]}
          <span>{tb.label}</span>
          {tb.key === "memories" && letterBadge && <span className="dot" aria-label="新しい便り" />}
        </button>
      ))}
    </nav>
  );
}

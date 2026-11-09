import { navigate } from "../router";
import { useT } from "../i18n";

const TABS: { key: string; path: string; icon: string; label: "tab_plan" | "tab_map" | "tab_memories" | "tab_wallet" }[] = [
  { key: "plan", path: "/plan", icon: "calendar", label: "tab_plan" },
  { key: "map", path: "/", icon: "pin", label: "tab_map" },
  { key: "memories", path: "/memories", icon: "letter", label: "tab_memories" },
  { key: "wallet", path: "/wallet", icon: "ticket", label: "tab_wallet" },
];

export function TabBar({ active, letterBadge }: { active: string; letterBadge?: boolean }) {
  const t = useT();
  return (
    <nav className="tabbar" aria-label="メイン">
      {TABS.map((tb) => (
        <button key={tb.key} className={active === tb.key ? "on" : ""} onClick={() => navigate(tb.path)} aria-current={active === tb.key ? "page" : undefined}>
          <img src={`/img/icons/${tb.icon}.svg`} alt="" aria-hidden="true" />
          <span>{t(tb.label)}</span>
          {tb.key === "memories" && letterBadge && <span className="dot" aria-label="新しい便り" />}
        </button>
      ))}
    </nav>
  );
}

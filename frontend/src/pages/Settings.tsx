import { useT } from "../i18n";
import { setPrefs, usePrefs, type FontSize } from "../settings";
import { TopBar } from "../components/ui";

export function SettingsPage() {
  const t = useT();
  const p = usePrefs();
  return (
    <div className="page">
      <TopBar title={t("settings")} backTo="/" />
      <div className="card stack">
        <div>
          <div className="title">{t("font_size")}</div>
          <div className="grid3" style={{ marginTop: 8 }}>
            {([1, 2, 3] as FontSize[]).map((n) => (
              <button key={n} className={`btn small ${p.fontSize === n ? "primary" : ""}`} onClick={() => setPrefs({ fontSize: n })}>
                {n === 1 ? "小" : n === 2 ? "中" : "大"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="title">{t("theme")}</div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <button className={`btn small ${p.theme === "standard" ? "primary" : ""}`} onClick={() => setPrefs({ theme: "standard" })}>
              {t("standard")}
            </button>
            <button className={`btn small ${p.theme === "contrast" ? "primary" : ""}`} onClick={() => setPrefs({ theme: "contrast" })}>
              {t("contrast")}
            </button>
          </div>
        </div>
        <div>
          <div className="title">{t("easy_ja")}</div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <button className={`btn small ${!p.easy ? "primary" : ""}`} onClick={() => setPrefs({ easy: false })}>
              ふつう
            </button>
            <button className={`btn small ${p.easy ? "primary" : ""}`} onClick={() => setPrefs({ easy: true })}>
              やさしい
            </button>
          </div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 12 }}>設定はこの端末だけに保存されます。</p>
    </div>
  );
}

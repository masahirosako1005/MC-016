/**
 * 運営の窓「次の一手」。データから規則で組み立てた提案を、優先度順に並べて「やる」ボタンを添える。
 * デモは規則ベース。本番では生成 AI が下書きする想定（docs/04_features.md）。順位・格付けは作らない。
 */
import { useEffect, useState } from "react";
import { get } from "../api";

export type Advice = {
  priority: "high" | "mid" | "low";
  title: string;
  why: string;
  action: { label: string; kind: string; params: Record<string, unknown> };
};

const PRIO: Record<Advice["priority"], string> = { high: "いますぐ", mid: "今週中に", low: "余裕があれば" };

export function AdvicePanel({ path, onAction, deps = [] }: { path: string; onAction: (a: Advice["action"]) => void; deps?: unknown[] }) {
  const [items, setItems] = useState<Advice[] | null>(null);
  useEffect(() => {
    let alive = true;
    get<{ advice: Advice[]; note?: string }>(path)
      .then((r) => {
        if (!alive) return;
        setItems(r.advice ?? []);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return (
    <div className="card" style={{ borderColor: "var(--ai-900)" }}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <img src="/img/mascot/ui/hoshimaru_point.png" alt="" width={56} height={56} style={{ flex: "none" }} />
        <div className="grow">
          <div className="title">ほしまるの「次の一手」</div>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {items === null && <div className="muted small">考え中…</div>}
        {items?.length === 0 && <div className="muted small">いまは特にありません。</div>}
        {items?.map((a, i) => (
          <div key={i} className="advice-item" style={{ borderTop: i ? "1px solid var(--ai-100)" : undefined }}>
            <span className={`badge ${a.priority === "high" ? "flower" : a.priority === "mid" ? "" : "soft"}`} style={{ minWidth: 74, textAlign: "center", alignSelf: "start" }}>{PRIO[a.priority]}</span>
            <div>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div className="muted small">{a.why}</div>
            </div>
            <button className="btn small" onClick={() => onAction(a.action)}>{a.action.label}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 運営の窓: 旅のあとのアンケートの結果。
 * 地域（DMO）は島ぜんたいの集計（満足度・また来たいか・よかったこと・困ったこと・声）。
 * お店は「自分の場所についての声」だけ（タグと文章。点数や順位は出さない）。3 件未満は出さない。
 */
import { useEffect, useState } from "react";
import { get } from "../api";
import { Stat } from "./charts";

type Tag = { key: string; label: string; count: number };
type Dist = { avg: number; labels: string[]; counts: number[]; top2_rate: number };
type Summary = {
  n: number; dummy_n: number; suppressed: boolean; scope: "island" | "place"; place?: string | null;
  good: Tag[]; trouble: Tag[]; satisfaction: Dist | null; revisit: Dist | null;
  comments: { date: string; place: string | null; text: string; trouble: string[]; is_dummy: boolean }[];
};

function Bars({ title, items, accentMax }: { title: string; items: { label: string; count: number }[]; accentMax?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="card">
      <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div className="stack" style={{ gap: 6 }}>
        {items.map((i) => (
          <div key={i.label} className="hbar">
            <span className="lbl small">{i.label}</span>
            <span className="track"><i style={{ width: `${(i.count / max) * 100}%`, background: accentMax && i.count === max && i.count > 0 ? "var(--yamabuki)" : "var(--ai-700)" }} /></span>
            <span className="num small">{i.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SurveyPanel({ path }: { path: string }) {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    let alive = true;
    get<Summary>(path).then((r) => alive && setS(r)).catch(() => alive && setS(null));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!s) return <p className="muted">読み込み中…</p>;
  if (s.suppressed) {
    return <div className="card muted">{s.scope === "place" ? `${s.place ?? "この場所"}についての声は、まだ ${s.n} 件です。` : `回答はまだ ${s.n} 件です。`}3 件たまると表示します。</div>;
  }
  const noTrouble = s.trouble.filter((t) => t.key !== "none");
  return (
    <div>
      {s.scope === "island" && s.satisfaction && s.revisit && (
        <>
          <div className="grid3" style={{ marginBottom: 10 }}>
            <Stat label="回答" value={`${s.n} 件`} sub={s.dummy_n ? `うちダミー ${s.dummy_n}` : undefined} accent />
            <Stat label="満足（やや満足以上）" value={`${Math.round(s.satisfaction.top2_rate * 100)}%`} sub={`平均 ${s.satisfaction.avg.toFixed(1)} / 5`} />
            <Stat label="また来たい" value={`${Math.round(s.revisit.top2_rate * 100)}%`} sub={`平均 ${s.revisit.avg.toFixed(1)} / 5`} />
          </div>
          <div className="grid2" style={{ marginBottom: 10 }}>
            <Bars title="今回の旅は、どうでしたか" items={s.satisfaction.labels.map((l, i) => ({ label: l, count: s.satisfaction!.counts[i] }))} />
            <Bars title="また来たいと思いますか" items={s.revisit.labels.map((l, i) => ({ label: l, count: s.revisit!.counts[i] }))} />
          </div>
        </>
      )}
      {s.scope === "place" && <p className="muted small" style={{ marginTop: 0 }}>{s.place}についての声 {s.n} 件{s.dummy_n ? `（うちダミー ${s.dummy_n}）` : ""}</p>}
      <div className="grid2" style={{ marginBottom: 10 }}>
        <Bars title="困ったこと" items={noTrouble} accentMax />
        <Bars title="よかったこと" items={s.good} />
      </div>
      <div className="card">
        <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>旅行者の声（新しい順）</div>
        {s.comments.length === 0 && <div className="muted small">文章の声は、まだありません。</div>}
        <div className="stack" style={{ gap: 8 }}>
          {s.comments.map((c, i) => (
            <div key={i} style={{ borderTop: i ? "1px solid var(--ai-100)" : undefined, paddingTop: i ? 8 : 0 }}>
              <div>{c.text}</div>
              <div className="muted small">
                {c.date.slice(5).replace("-", "/")}{c.place ? `・${c.place}` : "・島ぜんたい"}
                {c.trouble.length > 0 && <>　{c.trouble.map((t) => <span key={t} className="badge soft" style={{ marginRight: 4 }}>{t}</span>)}</>}
                {c.is_dummy && "（ダミー）"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

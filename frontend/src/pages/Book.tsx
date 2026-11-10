/** ひとめぐり帖: 島の 8 人をカードで集める。会えた人は色がつき、花が増える。コンプリートしたくなる帖。 */
import { useEffect, useState } from "react";
import { get, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { Relationship, Seed } from "../types";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
import { Badge, Loading, TopBar } from "../components/ui";

type BookView = {
  today: string; season_label: string;
  people: { id: number; name: string; intro: string; image: string; role: string; shop: { id: number; name: string; area: string }; relationship: Relationship; met_days: string[]; met_today: boolean; seed: Seed | null; fulfilled: { title: string; season_label: string; fulfilled_on: string }[] }[];
  album: { id: number; url: string; kind: string; title: string; taken_on: string; season_label: string; is_sample: boolean }[];
  trips: { start: string; end: string; days: number; season_label: string; spots: string[]; people: string[]; photos: number; spent: number; current: boolean }[];
};

export function BookPage() {
  const t = useT();
  const [b, setB] = useState<BookView | null>(null);
  const [help, setHelp] = useState(0);
  useEffect(() => {
    get<BookView>("/book").then(setB).catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!b) return <div className="page"><Loading /></div>;
  const met = b.people.filter((p) => p.relationship.days > 0);
  const ranks = { first: 0, again: 0, regular: 0 } as Record<string, number>;
  for (const p of b.people) if (p.relationship.stage in ranks) ranks[p.relationship.stage] += 1;
  const sorted = [...b.people].sort((x, y) => Number(y.relationship.days > 0) - Number(x.relationship.days > 0) || x.id - y.id);
  return (
    <div className="page">
      <Tutorial id="book" steps={TIPS.book} trigger={help} />
      <TopBar title={t("tab_book")} right={<HelpButton onClick={() => setHelp((n) => n + 1)} />} />
      <div className="card highlight">
        <div className="row between">
          <div>
            <div className="muted small">会えた人</div>
            <div className="title" style={{ fontSize: "2rem", lineHeight: 1.1 }}>{met.length} <span style={{ fontSize: "1rem" }}>/ {b.people.length} 人</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted small">会えた回数の帯</div>
            <div className="stack" style={{ gap: 3, alignItems: "flex-end", marginTop: 4 }}>
              <span className="badge rank-regular">おなじみ {ranks.regular}</span>
              <span className="badge rank-again">また会えたね {ranks.again}</span>
              <span className="badge rank-first">はじめまして {ranks.first}</span>
            </div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${(met.length / b.people.length) * 100}%` }} /></div>
        <div className="muted small" style={{ marginTop: 6 }}>
          {met.length === b.people.length ? "島の全員に会えました。おかえりなさい。" : `あと ${b.people.length - met.length} 人で、星凪諸島の人たち全員に会えます。`}
          <br />帯は会えた回数で変わります: 1 回=はじめまして（銅）→ 2 回=また会えたね（銀）→ 3 回以上=おなじみ（金）。
        </div>
      </div>

      <h2>島の人たち</h2>
      <div className="collect">
        {sorted.map((p) => {
          const isMet = p.relationship.days > 0;
          return (
            <button key={p.id} className={`ccard ${isMet ? "met" : "unmet"}`} onClick={() => navigate(`/people/${p.id}`)} style={{ cursor: "pointer" }}>
              {isMet && RANK[p.relationship.stage] && <span className={`stamp-met ${RANK[p.relationship.stage].cls}`}>{RANK[p.relationship.stage].label}</span>}
              <img src={p.image} alt={p.name} style={{ width: 84, height: 84, objectFit: "cover", objectPosition: "top", borderRadius: "50%", border: `2px solid ${isMet ? "var(--ai-900)" : "var(--ai-100)"}`, background: "var(--ai-050)" }} />
              <div className="serif" style={{ fontSize: "1.05rem", marginTop: 6 }}>{isMet ? p.name : "？？？"}</div>
              <div className="muted small">{p.role}</div>
              <div className="muted small">{p.shop.area}</div>
            </button>
          );
        })}
      </div>

      <h2>これまでの旅</h2>
      {b.trips.length === 0 && <p className="muted">まだありません。</p>}
      <div className="stack">
        {b.trips.map((tr) => (
          <div key={tr.start} className={`card ${tr.current ? "highlight" : ""}`}>
            <div className="row between">
              <span className="title" style={{ fontSize: "1rem" }}>{tr.start.replace(/-/g, "/")}{tr.days > 1 ? `〜${tr.end.slice(5).replace("-", "/")}` : ""}（{tr.days} 日）</span>
              <Badge soft>{tr.season_label}</Badge>
            </div>
            <div className="muted small">
              {tr.spots.length > 0 && <>行った場所: {tr.spots.join("、")}<br /></>}
              {tr.people.length > 0 && <>会えた人: {tr.people.join("、")}<br /></>}
              写真 {tr.photos} 枚{tr.spent > 0 ? `・お買いもの ${tr.spent.toLocaleString()} 円` : ""}
            </div>
          </div>
        ))}
      </div>

      <h2>アルバム</h2>
      {b.album.length === 0 && <p className="muted">AR フォトを撮ると、ここに並びます。</p>}
      <div className="grid3">
        {b.album.map((p) => (
          <button key={p.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer", textAlign: "left" }} onClick={() => navigate(`/photo/${p.id}`)}>
            <img src={p.url} alt={p.title} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
            <div className="muted" style={{ fontSize: "0.75rem" }}>{p.taken_on.slice(5).replace("-", "/")} {p.title.split("（")[0]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}


const RANK: Record<string, { label: string; cls: string }> = {
  first: { label: "はじめまして", cls: "rank-first" },
  again: { label: "また会えたね", cls: "rank-again" },
  regular: { label: "おなじみ", cls: "rank-regular" },
};

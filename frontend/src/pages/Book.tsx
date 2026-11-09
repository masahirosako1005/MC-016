/** ひとめぐり帖: 島の 8 人をカードで集める。会えた人は色がつき、花が増える。コンプリートしたくなる帖。 */
import { useEffect, useState } from "react";
import { get, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { Relationship, Seed } from "../types";
import { SeedIcon } from "../components/art";
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
  const flowers = b.people.reduce((n, p) => n + p.fulfilled.length, 0);
  const stamps = b.people.reduce((n, p) => n + new Set(p.met_days.map(seasonOf)).size, 0);
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
            <div className="muted small">季節のスタンプ</div>
            <div className="title" style={{ fontSize: "2rem", lineHeight: 1.1 }}>{stamps} <span style={{ fontSize: "1rem" }}>/ {b.people.length * 4}</span></div>
            <div className="muted small">果たした約束（花） {flowers}</div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${(met.length / b.people.length) * 100}%` }} /></div>
        <div className="muted small" style={{ marginTop: 6 }}>
          {met.length === b.people.length ? "島の全員に会えました。おかえりなさい。" : `あと ${b.people.length - met.length} 人で、星凪諸島の人たち全員に会えます。`}
          <br />会えた季節にスタンプが押されます（数字は会えた回数）。春夏秋冬の 4 つがそろうと、その人と一年をめぐったしるし。
        </div>
      </div>

      <h2>島の人たち</h2>
      <div className="collect">
        {sorted.map((p) => {
          const isMet = p.relationship.days > 0;
          return (
            <button key={p.id} className={`ccard ${isMet ? "met" : "unmet"}`} onClick={() => navigate(`/people/${p.id}`)} style={{ cursor: "pointer" }}>
              {isMet && <span className="stamp-met">会えた</span>}
              {p.fulfilled.length > 0 && (
                <span className="flowers">{p.fulfilled.map((_, i) => <svg key={i} viewBox="0 0 24 24" width="16" height="16"><g>{[0, 60, 120, 180, 240, 300].map((a) => <ellipse key={a} cx="12" cy="7" rx="3" ry="5" fill="#e3a21a" transform={`rotate(${a} 12 12)`} />)}</g><circle cx="12" cy="12" r="3.5" fill="#fbfcfd" /></svg>)}</span>
              )}
              <img src={p.image} alt={p.name} style={{ width: 84, height: 84, objectFit: "cover", objectPosition: "top", borderRadius: "50%", border: `2px solid ${isMet ? "var(--ai-900)" : "var(--ai-100)"}`, background: "var(--ai-050)" }} />
              <div className="serif" style={{ fontSize: "1.05rem", marginTop: 6 }}>{isMet ? p.name : "？？？"}</div>
              <div className="muted small">{p.role}・{p.shop.area}</div>
              <div style={{ marginTop: 4 }}>
                {isMet ? <Badge strong>{p.relationship.label}</Badge> : <Badge soft>まだ会っていない</Badge>}
              </div>
              <SeasonStamps days={p.met_days} />
              {p.seed && (
                <div className="row small" style={{ gap: 4, justifyContent: "center", marginTop: 4 }}>
                  <SeedIcon state={p.seed.state} size={16} />
                  <span className="muted">{p.seed.season_label}「{p.seed.title}」</span>
                </div>
              )}
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


const SEASONS = [["spring", "春"], ["summer", "夏"], ["autumn", "秋"], ["winter", "冬"]] as const;
function seasonOf(day: string): string {
  const m = Number(day.slice(5, 7));
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
}
/** 季節の絵のスタンプ（春=桜・夏=太陽と波・秋=もみじ・冬=雪の結晶）。会えた季節は藍のインクで押され、回数を山吹の札で添える。4 つそろうと「一年めぐった」。 */
function SeasonStamps({ days }: { days: string[] }) {
  const counts: Record<string, number> = {};
  for (const d of days) counts[seasonOf(d)] = (counts[seasonOf(d)] ?? 0) + 1;
  const all = SEASONS.every(([k]) => counts[k]);
  return (
    <div className="sstamps" aria-label="季節のスタンプ">
      {SEASONS.map(([k, label], i) => (
        <SeasonStamp key={k} season={k} label={label} count={counts[k] ?? 0} tilt={[-9, 6, -5, 8][i]} />
      ))}
      {all && <span className="badge flower sstamp-all">一年めぐった</span>}
    </div>
  );
}
function SeasonStamp({ season, label, count, tilt }: { season: string; label: string; count: number; tilt: number }) {
  const on = count > 0;
  const ink = on ? "#1b2a44" : "#a9b4c8";
  return (
    <span className={`sstamp2 ${on ? "on" : ""}`} style={{ transform: on ? `rotate(${tilt}deg)` : undefined }} title={on ? `${label}に ${count} 回` : `${label}はまだ`}>
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill={on ? "#fbfcfd" : "none"} stroke={ink} strokeWidth={on ? 2.2 : 1.2} strokeDasharray={on ? "26 2 10 2 18 3 30 2" : "3 3"} opacity={on ? 0.9 : 0.8} />
        <circle cx="24" cy="24" r="18.5" fill="none" stroke={ink} strokeWidth="0.8" opacity={on ? 0.55 : 0.3} />
        <g fill={ink} stroke={ink} opacity={on ? 0.9 : 0.35}>
          {season === "spring" && (
            <g transform="translate(24 22)">
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-6.5" rx="3.6" ry="5.6" transform={`rotate(${a})`} stroke="none" />)}
              <circle r="2.4" fill="#fbfcfd" stroke="none" />
              <circle r="1.1" fill={on ? "#e3a21a" : ink} stroke="none" />
            </g>
          )}
          {season === "summer" && (
            <g transform="translate(24 21)" strokeLinecap="round">
              <circle r="5.5" stroke="none" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="0" y1="-8" x2="0" y2="-10.5" strokeWidth="1.8" transform={`rotate(${a})`} />)}
              <path d="M-13 12 q3 -3 6 0 t6 0 t6 0 t6 0" fill="none" strokeWidth="1.6" />
            </g>
          )}
          {season === "autumn" && (
            <g transform="translate(24 23)">
              <path d="M0 -11 L2.5 -4 L9 -7 L5.5 -1 L11 3 L4 3 L4 10 L0 5 L-4 10 L-4 3 L-11 3 L-5.5 -1 L-9 -7 L-2.5 -4 Z" stroke="none" />
              <line x1="0" y1="5" x2="0" y2="13" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          )}
          {season === "winter" && (
            <g transform="translate(24 22)" fill="none" strokeWidth="1.6" strokeLinecap="round">
              {[0, 60, 120].map((a) => (
                <g key={a} transform={`rotate(${a})`}>
                  <line x1="0" y1="-11" x2="0" y2="11" />
                  <path d="M-3 -7 L0 -4 L3 -7 M-3 7 L0 4 L3 7" />
                </g>
              ))}
            </g>
          )}
        </g>
        <text x="24" y="42" textAnchor="middle" fontSize="7" fontWeight="700" fill={ink} opacity={on ? 0.9 : 0.6} fontFamily="'Yu Mincho', serif">{label}</text>
      </svg>
      {count > 1 && <span className="n">{count}</span>}
    </span>
  );
}

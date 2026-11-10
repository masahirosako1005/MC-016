/** 運営の窓。事業者向け。DEMO_MODE と関係なく動く。利用者には見せない情報（補填など）もここだけ。 */
import { useEffect, useState } from "react";
import { get, post, put, sendForm, toast } from "../api";
import { navigate, useRoute } from "../router";
import { BarChart, LineChart, Stat } from "../components/charts";
import { AdvicePanel, scrollToId, type Advice } from "../components/advice";
import { SubNav, useSubTab } from "../components/subnav";
import { ShopPanel } from "./AdminShop";

type MetricVal = { value: number | null; n: number; dummy_n: number; unit: string; suppressed: boolean };
type Metrics = {
  as_of: string; note: string;
  revisit_rate: MetricVal; visit_interval_median_days: MetricVal; post_trip_open_rate: MetricVal; satisfied_but_no_revisit_rate: MetricVal;
  spend_by_area: Record<string, MetricVal>; spend_total: MetricVal; coupon_revisits: MetricVal; plan_to_visit_rate: MetricVal;
  counts: Record<string, number>;
};
type Prize = { id: number; category: string; name: string; face_value: number; weight: number; stock: number | null; enabled: number; probability: number; in_stock: boolean };
type Overview = {
  shops: { id: number; name: string; area: string; category: string; rate_percent: number; person_name?: string | null }[];
  prizes: Prize[];
  history: { id: number; at: string; kind: string; target: string; before: unknown; after: unknown }[];
  recent_receipts: { id: number; user_id: number; amount: number; rate_percent: number; points: number; received_on: string; shop_name: string; has_image: boolean; image_url: string | null }[];
  import_runs: { id: number; at: string; file: string; ok_count: number; fail_count: number }[];
  sample_dir: string; sample_files: string[]; dummy: Record<string, number>; demo_mode: boolean;
};
type ImportResult = { file: string; kind: string; total: number; ok: number; inserted: number; fail_count: number; failed: { row: number; reason: string }[] };

const LABELS: Record<string, string> = {
  revisit_rate: "再訪率", visit_interval_median_days: "訪問間隔の中央値", post_trip_open_rate: "旅の後の起動率",
  satisfied_but_no_revisit_rate: "満足なのに再訪なし", coupon_revisits: "クーポンを使った再訪", plan_to_visit_rate: "つぎの旅 → 来訪", spend_total: "地域での消費額（合計）",
};

export function fmtMetric(m: MetricVal): string {
  if (m.suppressed || m.value === null) return "—";
  if (m.unit === "割合") return `${(m.value * 100).toFixed(1)}%`;
  if (m.unit === "円") return `${Math.round(m.value).toLocaleString()} 円`;
  if (m.unit === "日") return `${m.value} 日`;
  return `${m.value} ${m.unit}`;
}

export function MetricsGrid({ m, compact }: { m: Metrics; compact?: boolean }) {
  const keys = ["revisit_rate", "visit_interval_median_days", "post_trip_open_rate", "satisfied_but_no_revisit_rate", "coupon_revisits", "plan_to_visit_rate", "spend_total"] as const;
  return (
    <div className="grid2" style={compact ? { gap: 6 } : undefined}>
      {keys.map((k) => {
        const v = m[k];
        return (
          <div key={k} className="card" style={compact ? { padding: 8 } : undefined}>
            <div className="muted" style={{ fontSize: "0.8rem" }}>{LABELS[k]}</div>
            <div style={{ fontSize: compact ? "1.2rem" : "1.5rem", fontWeight: 800 }}>{fmtMetric(v)}</div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>{v.suppressed ? `対象 ${v.n} 人（3 人未満は非表示）` : `n=${v.n}（ダミー ${v.dummy_n}）`}</div>
          </div>
        );
      })}
    </div>
  );
}

/** 運営の窓は 2 つの立場で使う: 地域 DMO と、お店・施設の人。 */
export function AdminPage() {
  const route = useRoute();
  const [gear, setGear] = useState(false);
  const [role, setRole] = useState<"dmo" | "shop">(() => {
    try {
      return (localStorage.getItem("hitomeguri.admin.role") as "dmo" | "shop") || "dmo";
    } catch {
      return "dmo";
    }
  });
  const pick = (r: "dmo" | "shop") => {
    setRole(r);
    try {
      localStorage.setItem("hitomeguri.admin.role", r);
    } catch {
      /* ignore */
    }
  };
  // present（発表用）や URL から立場を受け取る: #/admin?role=shop
  const qrole = route.query.get("role");
  useEffect(() => {
    if (qrole === "dmo" || qrole === "shop") pick(qrole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrole]);
  return (
    <div className="page wide" style={{ maxWidth: 1100 }}>
      <header className="adminhead">
        <div className="row between" style={{ gap: 8 }}>
          <div>
            <h1 style={{ margin: 0 }}>運営の窓 <span className="muted" style={{ fontSize: ".95rem", fontWeight: 400 }}>— {role === "dmo" ? "地域（DMO）" : "お店・施設"}</span></h1>
          </div>
          <button className="btn small ghost" onClick={() => navigate("/")}>本体へ</button>
        </div>
      </header>
      {role === "dmo" ? <DmoPanel onShop={() => pick("shop")} /> : <ShopPanel />}

      {/* デモ用の設定: 立場の切り替え。フローティングで出て、選ぶと閉じる */}
      <button className="fab" aria-label="デモ設定" title="デモ設定（立場の切り替え）" onClick={() => setGear((g) => !g)}>⚙</button>
      {gear && (
        <div className="floatpanel" role="dialog" aria-label="デモ設定">
          <div className="row between"><b>デモ設定</b><button className="iconbtn" aria-label="とじる" onClick={() => setGear(false)}>×</button></div>
          <div className="muted small" style={{ margin: "4px 0 8px" }}>見る立場を切り替えます。</div>
          <div className="stack" style={{ gap: 6 }}>
            <button className={`btn ${role === "dmo" ? "primary" : "ghost"}`} onClick={() => { pick("dmo"); setGear(false); }}>地域（DMO）として見る</button>
            <button className={`btn ${role === "shop" ? "primary" : "ghost"}`} onClick={() => { pick("shop"); setGear(false); }}>お店・施設として見る</button>
          </div>
        </div>
      )}
    </div>
  );
}

type Dash = {
  months: string[];
  series: { month: string; spend: number; spend_dummy: number; visitors: number; meetings: number; receipts: number }[];
  by_area: { area: string; total: number }[];
  by_category: { category: string; total: number }[];
  summary: { spend_this_month: number; spend_prev_month: number; visitors_this_month: number; visitors_prev_month: number; meetings_this_month: number };
  note: string;
};
type Ev = { id: number; date: string; title: string; kind: string; expected: number | null; note: string | null; source: string };

function pct(a: number, b: number) {
  if (!b) return "—";
  const p = ((a - b) / b) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(0)}% 前月比`;
}

function DmoDashboard() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    get<Dash>("/admin/dashboard").then(setD).catch((e) => toast((e as Error).message, "error"));
  }, []);
  if (!d) return <p className="muted">読み込み中…</p>;
  const labels = d.series.map((s) => s.month);
  return (
    <>
      <div className="grid3" style={{ marginBottom: 10 }}>
        <Stat label="今月の観光消費額" value={`${d.summary.spend_this_month.toLocaleString()} 円`} sub={pct(d.summary.spend_this_month, d.summary.spend_prev_month)} accent />
        <Stat label="今月の来訪者数" value={`${d.summary.visitors_this_month} 人`} sub={pct(d.summary.visitors_this_month, d.summary.visitors_prev_month)} />
        <Stat label="今月の「会えた」" value={`${d.summary.meetings_this_month} 回`} sub="人に会った回数" />
      </div>
      <div className="grid2">
        <div className="card"><LineChart title="観光消費額の推移（月）" labels={labels} values={d.series.map((s) => s.spend)} unit="円" /></div>
        <div className="card"><BarChart title="来訪者数の推移（月）" labels={labels} values={d.series.map((s) => s.visitors)} unit="人" /></div>
        <div className="card"><BarChart title="「会えた」の推移（月）" labels={labels} values={d.series.map((s) => s.meetings)} unit="回" /></div>
        <div className="card">
          <div className="small" style={{ fontWeight: 700 }}>消費の内訳</div>
          <table className="tbl" style={{ marginTop: 6 }}>
            <tbody>
              {d.by_area.map((a) => <tr key={a.area}><td>{a.area}</td><td className="num">{a.total.toLocaleString()} 円</td></tr>)}
              {d.by_category.map((c) => <tr key={c.category}><td className="muted">{c.category}</td><td className="num muted">{c.total.toLocaleString()} 円</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">{d.note}</p>
    </>
  );
}

function EventsPanel({ editable }: { editable: boolean }) {
  const [evs, setEvs] = useState<Ev[] | null>(null);
  const [f, setF] = useState({ date: "", title: "", kind: "スポーツ", expected: "", note: "" });
  const load = async () => setEvs((await get<{ events: Ev[] }>("/admin/events")).events);
  useEffect(() => {
    load().catch(() => setEvs([]));
  }, []);
  return (
    <div className="card stack">
      <div className="muted small">地域起因ではないイベント（スポーツの試合、コンサートなど）を DMO が登録し、お店に知らせます。仕入れや人手の準備に。</div>
      {editable && (
        <div className="grid3" style={{ alignItems: "end" }}>
          <label className="field" style={{ margin: 0 }}><span>日付</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="field" style={{ margin: 0 }}><span>イベント名</span><input type="text" value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="例: J1 ホームゲーム" /></label>
          <label className="field" style={{ margin: 0 }}><span>種類</span><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["スポーツ", "音楽", "学会・大会", "連休", "その他"].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field" style={{ margin: 0 }}><span>見込み人数</span><input type="number" min={0} value={f.expected} onChange={(e) => setF({ ...f, expected: e.target.value })} placeholder="15000" /></label>
          <label className="field" style={{ margin: 0 }}><span>メモ</span><input type="text" value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="16 時キックオフ、島への便が増える" /></label>
          <button className="btn primary" disabled={!f.date || !f.title} onClick={async () => { try { await post("/admin/events", { date: f.date, title: f.title, kind: f.kind, expected: f.expected ? Number(f.expected) : null, note: f.note || null }); setF({ date: "", title: "", kind: "スポーツ", expected: "", note: "" }); await load(); toast("お知らせを登録しました"); } catch (e) { toast((e as Error).message, "error"); } }}>お店に知らせる</button>
        </div>
      )}
      <table className="tbl">
        <thead><tr><th>日付</th><th>イベント</th><th>種類</th><th className="num">見込み人数</th><th>メモ</th>{editable && <th></th>}</tr></thead>
        <tbody>
          {(evs ?? []).map((e) => (
            <tr key={e.id}><td>{e.date.replace(/-/g, "/")}</td><td>{e.title}</td><td>{e.kind}</td><td className="num">{e.expected?.toLocaleString() ?? "—"}</td><td className="muted small">{e.note}</td>{editable && <td><button className="btn small ghost" onClick={async () => { await import("../api").then((a) => a.del(`/admin/events/${e.id}`)); await load(); }}>削除</button></td>}</tr>
          ))}
          {evs && evs.length === 0 && <tr><td colSpan={6} className="muted">登録されたイベントはありません</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const DMO_TABS = [
  { key: "home", label: "ホーム", icon: "⌂", desc: "次の一手と、観光消費・来訪者の推移" },
  { key: "events", label: "イベント・来訪予定", icon: "◷", desc: "外部イベントをお店へ知らせる／計画の日ごとの来訪予定" },
  { key: "metrics", label: "指標・補填", icon: "▦", desc: "再訪率などの指標と、使われたクーポンの補填額" },
  { key: "settings", label: "還元率・商品・取り込み", icon: "⚙", desc: "店の還元率、抽選の商品、CSV の取り込み" },
  { key: "records", label: "レシート・履歴", icon: "≡", desc: "直近のレシートと変更履歴" },
];

function DmoPanel({ onShop }: { onShop: () => void }) {
  const [tab, pick] = useSubTab("hitomeguri.admin.dmo.tab", "home");
  const go = (t: string, id: string) => {
    pick(t);
    setTimeout(() => scrollToId(id), 80);
  };
  const [m, setM] = useState<Metrics | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [preview, setPreview] = useState<ImportResult[] | null>(null);
  const [imported, setImported] = useState<{ results: ImportResult[]; dummy_rows: number } | null>(null);
  const [month, setMonth] = useState("2026-10");
  const [reimb, setReimb] = useState<{ rows: { shop_id: number; shop_name: string; area: string; category: string; used_count: number; amount: number }[]; total_count: number; total_amount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [mm, oo] = await Promise.all([get<Metrics>("/metrics"), get<Overview>("/admin/overview")]);
    setM(mm);
    setOv(oo);
  };
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, []);
  useEffect(() => {
    get<typeof reimb>(`/admin/reimbursement?month=${month}`).then(setReimb).catch(() => setReimb(null));
  }, [month, imported]);
  if (!m || !ov) return <p className="muted">読み込み中…</p>;
  return (
    <div>

      <SubNav items={DMO_TABS} value={tab} onChange={pick} crumb="運営の窓 › 地域（DMO）" />
      {tab === "home" && (
        <>
      <h2>次の一手</h2>
      <AdvicePanel
        path="/admin/advice"
        deps={[imported]}
        onAction={(a: Advice["action"]) => {
          if (a.kind === "notice" || a.kind === "shops_recommend") {
            toast(a.kind === "notice" ? "お店の窓で「便り」を送れます" : "お店の窓で「紹介を編集」できます");
            onShop();
          } else if (a.kind === "prizes") go("settings", "dmo-prizes");
          else if (a.kind === "events") go("events", "dmo-events");
          else go("events", "dmo-visits");
        }}
      />

      <h2>ダッシュボード（観光消費・来訪者の推移）</h2>
      <DmoDashboard />

        </>
      )}
      {tab === "events" && (
        <>
      <h2 id="dmo-events">イベントのお知らせ（お店へ）</h2>
      <EventsPanel editable />

      <h2 id="dmo-visits">来訪予定（いつ、だれが来るか）</h2>
      <VisitsTable />

        </>
      )}
      {tab === "metrics" && (
        <>
      <h2>指標</h2>
      <MetricsGrid m={m} />
      <div className="card" style={{ marginTop: 10 }}>
        <div className="title">地区ごとの消費額</div>
        <table className="tbl">
          <thead><tr><th>地区</th><th className="num">消費額</th><th className="num">n（ダミー）</th></tr></thead>
          <tbody>
            {Object.entries(m.spend_by_area).map(([area, v]) => (
              <tr key={area}><td>{area}</td><td className="num">{fmtMetric(v)}</td><td className="num">{v.n}（{v.dummy_n}）</td></tr>
            ))}
            {Object.keys(m.spend_by_area).length === 0 && <tr><td colSpan={3} className="muted">まだレシートがありません</td></tr>}
          </tbody>
        </table>
        <div className="muted" style={{ marginTop: 6 }}>
          利用者 {m.counts.users}・旅のある人 {m.counts.users_with_trip}・会えた {m.counts.meetings}・レシート {m.counts.receipts}・写真 {m.counts.photos}・クーポン使用 {m.counts.coupons_used}
          {ov.dummy.meetings > 0 && `／ダミー: 会えた ${ov.dummy.meetings}・レシート ${ov.dummy.receipts}・開封 ${ov.dummy.letter_opens}・クーポン ${ov.dummy.coupons}・計画 ${ov.dummy.plans}`}
        </div>
      </div>

      <h2>補填（使われたクーポン）</h2>
      <div className="card">
        <label className="field" style={{ maxWidth: 220 }}>
          <span>月</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        {reimb && (
          <table className="tbl">
            <thead><tr><th>店</th><th>地区</th><th>区分</th><th className="num">使用枚数</th><th className="num">補填額</th></tr></thead>
            <tbody>
              {reimb.rows.filter((r) => r.used_count > 0).map((r) => (
                <tr key={r.shop_id}><td>{r.shop_name}</td><td>{r.area}</td><td>{r.category}</td><td className="num">{r.used_count}</td><td className="num">{r.amount.toLocaleString()} 円</td></tr>
              ))}
              <tr><th>合計</th><td></td><td></td><th className="num">{reimb.total_count}</th><th className="num">{reimb.total_amount.toLocaleString()} 円</th></tr>
            </tbody>
          </table>
        )}
        <div className="muted" style={{ marginTop: 6 }}>額面の合計を、事業者から店へ補填する金額として示します。支払い状態の管理は行いません。</div>
      </div>

        </>
      )}
      {tab === "settings" && (
        <>
      <h2>CSV 取り込み</h2>
      <div className="card">
        <div className="muted">取り込み元: {ov.sample_dir}（{ov.sample_files.length} ファイル: {ov.sample_files.join(", ")}）。列名から種類を判定し、行ごとに検証。2 回取り込んでも増えません。</div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn small" disabled={busy} onClick={async () => { setBusy(true); try { setPreview((await post<{ results: ImportResult[] }>("/admin/import/preview")).results); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); } }}>確認（取り込まない）</button>
          <button className="btn small primary" disabled={busy} onClick={async () => { setBusy(true); try { setImported(await post("/admin/import")); await load(); toast("取り込みました"); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); } }}>取り込む（足りない履歴はダミーで補う）</button>
          <label className="btn small ghost" style={{ cursor: "pointer" }}>
            CSV をアップロード
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append("file", f);
              try {
                const r = await sendForm<ImportResult>("/admin/import/upload", fd);
                setImported({ results: [r], dummy_rows: 0 });
                await load();
              } catch (err) { toast((err as Error).message, "error"); }
            }} />
          </label>
        </div>
        {(preview || imported) && (
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead><tr><th>ファイル</th><th>種類</th><th className="num">行</th><th className="num">OK</th><th className="num">追加</th><th className="num">失敗</th><th>失敗行（理由）</th></tr></thead>
            <tbody>
              {(imported?.results ?? preview ?? []).map((r) => (
                <tr key={r.file}>
                  <td>{r.file}</td><td>{r.kind}</td><td className="num">{r.total}</td><td className="num">{r.ok}</td><td className="num">{r.inserted}</td><td className="num">{r.fail_count}</td>
                  <td className="muted" style={{ fontSize: "0.8rem" }}>{r.failed.slice(0, 5).map((f) => `${f.row}行目: ${f.reason}`).join(" / ")}{r.fail_count > 5 ? ` …他 ${r.fail_count - 5} 件` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {imported && imported.dummy_rows > 0 && <div className="muted">ダミー履歴を {imported.dummy_rows} 行作成しました（固定シード、is_dummy=1）。</div>}
        {ov.import_runs.length > 0 && <div className="muted" style={{ marginTop: 6 }}>最近の取り込み: {ov.import_runs.slice(0, 5).map((r) => `${r.at.replace("T", " ")} ${r.file}（OK ${r.ok_count}/失敗 ${r.fail_count}）`).join("、")}</div>}
      </div>

      <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
        <div>
          <h2 style={{ marginTop: 0 }}>店の還元率</h2>
          <div className="card">
            <table className="tbl">
              <thead><tr><th>店</th><th>区分</th><th className="num">還元率</th><th></th></tr></thead>
              <tbody>
                {ov.shops.map((s) => <RateRow key={s.id} shop={s} onSaved={load} />)}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 id="dmo-prizes" style={{ marginTop: 0 }}>抽選の商品（カテゴリ単位のクーポン）</h2>
          <div className="card">
            <table className="tbl">
              <thead><tr><th>商品</th><th className="num">額面</th><th className="num">重み</th><th className="num">在庫</th><th className="num">確率</th><th></th></tr></thead>
              <tbody>
                {ov.prizes.map((p) => <PrizeRow key={p.id} p={p} onSaved={load} />)}
              </tbody>
            </table>
            <div className="muted" style={{ marginTop: 6 }}>在庫 0 の商品の重みは「はずれ」に合算されます。確率は利用者の画面にも同じ値で表示されます。</div>
          </div>
        </div>
      </div>

        </>
      )}
      {tab === "records" && (
        <>
      <h2>直近のレシート（画像は 7 日で削除）</h2>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>日付</th><th>店</th><th className="num">金額</th><th className="num">率</th><th className="num">pt</th><th>画像</th></tr></thead>
          <tbody>
            {ov.recent_receipts.map((r) => (
              <tr key={r.id}>
                <td>{r.received_on}</td><td>{r.shop_name}</td><td className="num">{r.amount.toLocaleString()}</td><td className="num">{r.rate_percent}%</td><td className="num">{r.points}</td>
                <td>{r.image_url ? <a href={r.image_url} target="_blank" rel="noreferrer">見る</a> : <span className="muted">削除済み</span>}</td>
              </tr>
            ))}
            {ov.recent_receipts.length === 0 && <tr><td colSpan={6} className="muted">まだありません</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>変更履歴</h2>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>日時</th><th>種類</th><th>対象</th><th>前</th><th>後</th></tr></thead>
          <tbody>
            {ov.history.map((h) => (
              <tr key={h.id}><td>{h.at.replace("T", " ")}</td><td>{h.kind}</td><td>{h.target}</td><td className="muted">{h.before ? JSON.stringify(h.before) : "—"}</td><td>{JSON.stringify(h.after)}</td></tr>
            ))}
            {ov.history.length === 0 && <tr><td colSpan={5} className="muted">まだありません</td></tr>}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

function VisitsTable() {
  const [v, setV] = useState<{ visits: { date: string; plans: number; dummy: number; places: { name: string; n: number }[] }[]; today: string } | null>(null);
  useEffect(() => {
    get<typeof v>("/admin/visits").then(setV).catch(() => setV({ visits: [], today: "" }));
  }, []);
  if (!v) return <p className="muted">読み込み中…</p>;
  return (
    <div className="card">
      <div className="muted small" style={{ marginBottom: 6 }}>利用者が「計画」で決めた日ごとの件数と行き先。名前は出しません。お店の人の準備（仕込み・人手）に使います。</div>
      <table className="tbl">
        <thead><tr><th>日</th><th className="num">計画の数（ダミー）</th><th>行き先（件数）</th></tr></thead>
        <tbody>
          {v.visits.map((r) => (
            <tr key={r.date}><td>{r.date.replace(/-/g, "/")}</td><td className="num">{r.plans}（{r.dummy}）</td><td className="muted small">{r.places.map((p) => `${p.name} ${p.n}`).join("、")}</td></tr>
          ))}
          {v.visits.length === 0 && <tr><td colSpan={3} className="muted">まだ予定はありません</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RateRow({ shop, onSaved }: { shop: Overview["shops"][number]; onSaved: () => Promise<void> }) {
  const [v, setV] = useState(String(shop.rate_percent));
  useEffect(() => setV(String(shop.rate_percent)), [shop.rate_percent]);
  return (
    <tr>
      <td>{shop.name}{shop.person_name && <div className="muted small">{shop.person_name}</div>}</td><td>{shop.category}</td>
      <td className="num"><input type="number" min={1} max={20} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 70, minHeight: 36, padding: 4 }} /> %</td>
      <td>
        <button className="btn small" disabled={Number(v) === shop.rate_percent} onClick={async () => {
          try { await put(`/admin/shops/${shop.id}/rate`, { rate_percent: Number(v) }); toast(`${shop.name} の還元率を ${v}% にしました`); await onSaved(); } catch (e) { toast((e as Error).message, "error"); }
        }}>保存</button>
      </td>
    </tr>
  );
}

function PrizeRow({ p, onSaved }: { p: Prize; onSaved: () => Promise<void> }) {
  const [w, setW] = useState(String(p.weight));
  const [s, setS] = useState(p.stock === null ? "" : String(p.stock));
  const [f, setF] = useState(String(p.face_value));
  useEffect(() => { setW(String(p.weight)); setS(p.stock === null ? "" : String(p.stock)); setF(String(p.face_value)); }, [p]);
  const miss = p.category === "miss";
  const dirty = Number(w) !== p.weight || (miss ? false : (s === "" ? p.stock !== null : Number(s) !== p.stock) || Number(f) !== p.face_value);
  return (
    <tr style={{ opacity: p.in_stock ? 1 : 0.6 }}>
      <td>{p.name}<div className="muted" style={{ fontSize: "0.75rem" }}>{p.category}</div></td>
      <td className="num">{miss ? "—" : <input type="number" min={0} max={100000} value={f} onChange={(e) => setF(e.target.value)} style={{ width: 80, minHeight: 36, padding: 4 }} />}</td>
      <td className="num"><input type="number" min={0} max={1000} value={w} onChange={(e) => setW(e.target.value)} style={{ width: 64, minHeight: 36, padding: 4 }} /></td>
      <td className="num">{miss ? "—" : <input type="number" min={0} max={100000} value={s} placeholder="無制限" onChange={(e) => setS(e.target.value)} style={{ width: 72, minHeight: 36, padding: 4 }} />}</td>
      <td className="num">{(p.probability * 100).toFixed(1)}%</td>
      <td>
        <button className="btn small" disabled={!dirty} onClick={async () => {
          try {
            const body: Record<string, unknown> = { weight: Number(w) };
            if (!miss) { body.face_value = Number(f); if (s === "") body.unlimited = true; else body.stock = Number(s); }
            await put(`/admin/prizes/${p.id}`, body);
            toast(`${p.name} を更新しました`);
            await onSaved();
          } catch (e) { toast((e as Error).message, "error"); }
        }}>保存</button>
      </td>
    </tr>
  );
}

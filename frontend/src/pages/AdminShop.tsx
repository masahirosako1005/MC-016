/**
 * 運営の窓 › お店・施設の人向け: 次の一手（提案）、来訪のダッシュボード（地域平均との比較）、
 * お店の紹介の編集（写真・おすすめ・住所・電話・最寄り・営業時間）、イベントのお知らせ、旅行者への便り（来訪回数・種の状態で宛先を絞る）。
 */
import { useEffect, useRef, useState } from "react";
import { get, post, put, sendForm, toast } from "../api";
import { AdvicePanel, scrollToId, type Advice } from "../components/advice";
import { BarChart, Stat } from "../components/charts";
import { SubNav, useSubTab } from "../components/subnav";

type ShopRow = { id: number; name: string; area: string; category: string; person_name?: string | null };
type ShopDash = {
  shop: {
    id: number; name: string; area: string; category: string; description: string; access: string; rate_percent: number; spot_id: number; recommend: string | null; photo_url: string | null;
    address: string | null; phone: string | null; url: string | null; nearest: string | null; notes: string | null; open_time: string; close_time: string; closed_weekday: number | null;
  };
  person: { id: number; name: string; role: string } | null;
  months: string[];
  series: { month: string; meetings: number; spend: number; visitors: number; meetings_area_avg: number; meetings_island_avg: number; spend_area_avg: number; spend_island_avg: number }[];
  relationships: { first: number; again: number; regular: number };
  upcoming_events: { id: number; date: string; title: string; kind: string; expected: number | null; note: string | null }[];
  upcoming_visits: { date: string; plans: number }[];
  messages: { id: number; title: string; body: string; coupon_face_value: number | null; coupon_days: number | null; created_at: string; sent_to: number }[];
  coupons_used: { count: number; amount: number };
  reach: number;
  visitors: { user_id: number; days: number; last_met: string; first_met: string; stage: string; label: string; is_dummy: boolean }[];
};
type Audience = { total: number; selected: number; stages: { first: number; again: number; regular: number }; seeds: { none: number; bud: number; flower: number } };

const STAGES = [
  { key: "first", label: "はじめまして", sub: "会えた日 1 日" },
  { key: "again", label: "また会えたね", sub: "2〜3 日" },
  { key: "regular", label: "おなじみ", sub: "4 日以上" },
] as const;
const WEEKDAYS = "月火水木金土日";
const RANK_SHORT: Record<string, string> = { first: "はじめまして", again: "また会えたね", regular: "おなじみ" };
const SHOP_TABS = [
  { key: "home", label: "ホーム", icon: "⌂", desc: "次の一手と、来訪のようす（地区平均との比較）" },
  { key: "visits", label: "来訪・イベント", icon: "◷", desc: "会ったことのある旅行者、この場所に来る予定、DMO からのイベントのお知らせ" },
  { key: "info", label: "お店の情報", icon: "✎", desc: "紹介・おすすめ・写真・住所・電話・営業時間の編集" },
  { key: "letter", label: "旅行者への便り", icon: "✉", desc: "来訪回数で宛先を絞って、クーポン付きの便りを送る" },
];

type EditState = {
  description: string; access: string; recommend: string; address: string; phone: string; url: string; nearest: string; notes: string;
  open_time: string; close_time: string; closed_weekday: string;
};
const fromDash = (s: ShopDash["shop"]): EditState => ({
  description: s.description ?? "", access: s.access ?? "", recommend: s.recommend ?? "", address: s.address ?? "", phone: s.phone ?? "", url: s.url ?? "",
  nearest: s.nearest ?? "", notes: s.notes ?? "", open_time: s.open_time ?? "", close_time: s.close_time ?? "", closed_weekday: s.closed_weekday === null || s.closed_weekday === undefined ? "" : String(s.closed_weekday),
});

export function ShopPanel() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [shopId, setShopId] = useState<number>(() => Number(localStorage.getItem("hitomeguri.admin.shop") || 4));
  const [d, setD] = useState<ShopDash | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [msg, setMsg] = useState({ title: "", body: "", coupon: "", days: "60" });
  const [stages, setStages] = useState<string[]>([]);
  const [aud, setAud] = useState<Audience | null>(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, pick] = useSubTab("hitomeguri.admin.shop.tab", "home");
  const go = (t: string, id: string) => {
    pick(t);
    setTimeout(() => scrollToId(id), 80);
  };

  const load = async (id: number) => {
    const dd = await get<ShopDash>(`/admin/shops/${id}/dashboard`);
    setD(dd);
    setEdit(fromDash(dd.shop));
    setTick((n) => n + 1);
  };
  useEffect(() => {
    get<{ shops: ShopRow[] }>("/admin/overview").then((o) => setShops(o.shops)).catch(() => undefined);
  }, []);
  useEffect(() => {
    load(shopId).catch((e) => toast((e as Error).message, "error"));
    try {
      localStorage.setItem("hitomeguri.admin.shop", String(shopId));
    } catch {
      /* ignore */
    }
  }, [shopId]);
  useEffect(() => {
    const q = new URLSearchParams({ stages: stages.join(",") });
    get<Audience>(`/admin/shops/${shopId}/audience?${q}`).then(setAud).catch(() => setAud(null));
  }, [shopId, stages, tick]);

  if (!d || !edit) return <p className="muted">読み込み中…</p>;
  const labels = d.series.map((s) => s.month);
  const cur = d.series[d.series.length - 1];
  const toggle = (list: string[], set: (v: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const onAdvice = (a: Advice["action"]) => {
    const p = a.params as { stages?: string[]; seeds?: string[]; coupon?: number | null; title?: string; body?: string };
    if (a.kind === "message") {
      setStages(p.stages ?? []);
      setMsg({ title: p.title ?? "", body: p.body ?? "", coupon: p.coupon ? String(p.coupon) : "", days: "60" });
      go("letter", "shop-message");
      toast("宛先と下書きを入れました。直して送れます");
    } else if (a.kind === "edit") go("info", "shop-edit");
    else go("visits", "shop-visits");
  };

  const save = async () => {
    const body = {
      ...edit,
      open_time: edit.open_time || null, close_time: edit.close_time || null, closed_weekday: edit.closed_weekday === "" ? null : Number(edit.closed_weekday),
    };
    try {
      await put(`/admin/shops/${shopId}`, body);
      toast("保存しました。旅行者の場所画面にも反映されます");
      await load(shopId);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <div className="row wrap" style={{ gap: 10, marginBottom: 10 }}>
        <label className="field" style={{ margin: 0, maxWidth: 360 }}>
          <span>あなたのお店・施設（デモ: 切り替えられます）</span>
          <select value={shopId} onChange={(e) => setShopId(Number(e.target.value))}>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}{s.person_name ? `（${s.person_name}）` : ""}</option>)}
          </select>
        </label>
        <div className="muted small" style={{ alignSelf: "end" }}>{d.shop.area}・{d.shop.category}・還元 {d.shop.rate_percent}%</div>
      </div>

      <SubNav items={SHOP_TABS} value={tab} onChange={pick} crumb="運営の窓 › お店・施設" />
      {tab === "home" && (
        <>
      <h2>次の一手</h2>
      <AdvicePanel path={`/admin/shops/${shopId}/advice`} onAction={onAdvice} deps={[tick]} />

      <h2>来訪のようす</h2>
      <div className="grid3" style={{ marginBottom: 10 }}>
        <Stat label="今月、会えた旅行者" value={`${cur.meetings} 回`} sub={`地区平均 ${cur.meetings_area_avg} 回・島平均 ${cur.meetings_island_avg} 回`} accent />
        <Stat label="今月のお買いもの" value={`${cur.spend.toLocaleString()} 円`} sub={`地区平均 ${cur.spend_area_avg.toLocaleString()} 円`} />
        <Stat label="関係" value={`${d.relationships.first + d.relationships.again + d.relationships.regular} 人`} sub={`はじめまして ${d.relationships.first}・また会えたね ${d.relationships.again}・おなじみ ${d.relationships.regular}`} />
      </div>
      <div className="grid2">
        <div className="card"><BarChart title="会えた回数（自分 / 地区平均）" labels={labels} values={d.series.map((s) => s.meetings)} compare={d.series.map((s) => s.meetings_area_avg)} unit="回" compareLabel="地区平均" /></div>
        <div className="card"><BarChart title="お買いもの（自分 / 地区平均）" labels={labels} values={d.series.map((s) => s.spend)} compare={d.series.map((s) => s.spend_area_avg)} unit="円" compareLabel="地区平均" /></div>
      </div>
      <p className="muted small">地域内の横の誘客のために、近くのお店の平均と並べています。順位はつけません。</p>
        </>
      )}

      {tab === "visits" && (
        <div id="shop-visits">
          <h2>これから来る人・イベント</h2>
          <div className="card">
            <div className="small" style={{ fontWeight: 700 }}>会ったことのある旅行者（「会えた」を押してくれた人）</div>
            <table className="tbl"><tbody>
              {d.visitors.map((v) => (
                <tr key={v.user_id}>
                  <td style={{ whiteSpace: "nowrap" }}><span className={`badge rank-${v.stage}`}>{RANK_SHORT[v.stage] ?? v.label}</span></td>
                  <td>旅行者 {v.user_id}{v.is_dummy ? <span className="muted small">（ダミー）</span> : ""}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>{v.days} 日</td>
                  <td className="muted small" style={{ whiteSpace: "nowrap" }}>最後 {v.last_met.slice(5).replace("-", "/")}</td>
                </tr>
              ))}
              {d.visitors.length === 0 && <tr><td className="muted">まだ会った旅行者はいません</td></tr>}
            </tbody></table>
            <div className="muted small" style={{ marginBottom: 10 }}>「この人、前にも来てくれた」をお店の側でも思い出せるように。帯は旅行者のひとめぐり帖と同じ色です。</div>
            <div className="small" style={{ fontWeight: 700 }}>この場所に来る予定（旅行者の計画）</div>
            <table className="tbl"><tbody>
              {d.upcoming_visits.map((v) => <tr key={v.date}><td>{v.date.replace(/-/g, "/")}</td><td className="num">{v.plans} 件</td></tr>)}
              {d.upcoming_visits.length === 0 && <tr><td className="muted">まだ予定はありません</td></tr>}
            </tbody></table>
            <div className="small" style={{ fontWeight: 700, marginTop: 10 }}>DMO からのイベントのお知らせ</div>
            <table className="tbl"><tbody>
              {d.upcoming_events.map((e) => <tr key={e.id}><td>{e.date.replace(/-/g, "/")}</td><td>{e.title}<div className="muted small">{e.kind}{e.expected ? `・見込み ${e.expected.toLocaleString()} 人` : ""}{e.note ? `・${e.note}` : ""}</div></td></tr>)}
              {d.upcoming_events.length === 0 && <tr><td className="muted">いまはありません</td></tr>}
            </tbody></table>
            <div className="muted small" style={{ marginTop: 6 }}>見込み人数が大きい日は仕入れや人手を増やす目安に。</div>
          </div>
        </div>
      )}
      {tab === "info" && (
        <div id="shop-edit">
          <h2>お店の紹介を編集</h2>
          <div className="card stack">
            <div className="row">
              <div style={{ width: 120, height: 80, borderRadius: 8, overflow: "hidden", background: "var(--ai-050)", flex: "none" }}>
                <img src={d.shop.photo_url ?? `/img/places/${["", "lighthouse", "cape", "market", "lake", "windmill", "street", "hall"][d.shop.spot_id]}.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div className="grow">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("image", f); try { await sendForm(`/admin/shops/${shopId}/photo`, fd); toast("写真を変えました。旅行者の計画カードにも反映されます"); await load(shopId); } catch (err) { toast((err as Error).message, "error"); } }} />
                <button className="btn small" onClick={() => fileRef.current?.click()}>写真を変える</button>
                <div className="muted small" style={{ marginTop: 4 }}>旅行者の「計画」の場所カードに出る写真です（PNG/JPEG/WebP、5MB まで）。</div>
              </div>
            </div>
            <label className="field" style={{ margin: 0 }}><span>紹介文</span><textarea value={edit.description} maxLength={300} onChange={(e) => setEdit({ ...edit, description: e.target.value })} style={{ minHeight: 70 }} /></label>
            <label className="field" style={{ margin: 0 }}><span>おすすめのポイント（旅行者のカードに出ます）</span><textarea value={edit.recommend} maxLength={300} onChange={(e) => setEdit({ ...edit, recommend: e.target.value })} placeholder="例: 朝霧の時間、窓際の席が一番きれいです" style={{ minHeight: 60 }} /></label>

            <div className="small" style={{ fontWeight: 700, marginTop: 4 }}>旅行に必要な情報（場所の画面「行き方と連絡先」に出ます）</div>
            <label className="field" style={{ margin: 0 }}><span>住所</span><input type="text" value={edit.address} maxLength={120} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="例: 星凪県星凪郡星凪町雫森谷 2-7" /></label>
            <div className="grid2">
              <label className="field" style={{ margin: 0 }}><span>電話</span><input type="tel" value={edit.phone} maxLength={30} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="0XX-XXX-XXXX" /></label>
              <label className="field" style={{ margin: 0 }}><span>Web（任意）</span><input type="url" value={edit.url} maxLength={200} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://" /></label>
            </div>
            <label className="field" style={{ margin: 0 }}><span>最寄り（港・バス停・駐車場）</span><input type="text" value={edit.nearest} maxLength={120} onChange={(e) => setEdit({ ...edit, nearest: e.target.value })} placeholder="例: 星綴港から島内バス 12 分「湖畔」下車 徒歩 3 分" /></label>
            <label className="field" style={{ margin: 0 }}><span>行き方のひとこと（短く）</span><input type="text" value={edit.access} maxLength={120} onChange={(e) => setEdit({ ...edit, access: e.target.value })} /></label>
            <label className="field" style={{ margin: 0 }}><span>旅行者へのメモ（支払い・予約・持ち物など）</span><textarea value={edit.notes} maxLength={300} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="例: 現金・交通系 IC が使えます。体験は前日までに電話で予約。" style={{ minHeight: 56 }} /></label>
            <div className="grid3">
              <label className="field" style={{ margin: 0 }}><span>開店</span><input type="time" value={edit.open_time} onChange={(e) => setEdit({ ...edit, open_time: e.target.value })} /></label>
              <label className="field" style={{ margin: 0 }}><span>閉店</span><input type="time" value={edit.close_time} onChange={(e) => setEdit({ ...edit, close_time: e.target.value })} /></label>
              <label className="field" style={{ margin: 0 }}><span>定休日</span>
                <select value={edit.closed_weekday} onChange={(e) => setEdit({ ...edit, closed_weekday: e.target.value })}>
                  <option value="">無休</option>
                  {WEEKDAYS.split("").map((w, i) => <option key={w} value={i}>{w}曜</option>)}
                </select>
              </label>
            </div>
            <button className="btn primary" onClick={save}>保存する</button>
          </div>
        </div>
      )}

      {tab === "letter" && (
        <>
      <h2 id="shop-message">旅行者への便り（{d.person ? `${d.person.name}から` : "お店から"}）</h2>
      <div className="card stack">
        <div className="muted small">
          あなたに会ったことのある旅行者は <b>{d.reach} 人</b>。来訪回数（関係）で宛先を絞れます。クーポンを添えると、その人のクーポンにすぐ入ります（補填の対象）。
          これまでに使われたクーポン: {d.coupons_used.count} 枚・{d.coupons_used.amount.toLocaleString()} 円。
        </div>
        <div>
          <div>
            <div className="small" style={{ fontWeight: 700 }}>来訪回数（関係）で選ぶ — 1 回=はじめまして（銅）／2 回=また会えたね（銀）／3 回以上=おなじみ（金）</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
              {STAGES.map((s) => (
                <button key={s.key} className={`chip ${stages.includes(s.key) ? "on" : ""}`} onClick={() => toggle(stages, setStages, s.key)} title={s.sub}>
                  {s.label} {aud ? aud.stages[s.key] : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <img src="/img/mascot/ui/hoshimaru_letter.png" alt="" width={40} height={40} />
          <div className="grow">
            この条件で届く人: <b style={{ fontSize: "1.2rem" }}>{aud ? aud.selected : "…"} 人</b>
            <span className="muted small">（何も選ばなければ全員。数字はいまの人数の目安です）</span>
          </div>
          {stages.length > 0 && <button className="btn small ghost" onClick={() => setStages([])}>全員に</button>}
        </div>
        <div className="grid2">
          <label className="field" style={{ margin: 0 }}><span>件名</span><input type="text" value={msg.title} maxLength={60} onChange={(e) => setMsg({ ...msg, title: e.target.value })} placeholder="例: 雪見ぜんざい、はじめました" /></label>
          <div className="grid2">
            <label className="field" style={{ margin: 0 }}><span>クーポン（円引き、空なら無し）</span><input type="number" min={100} max={10000} step={100} value={msg.coupon} onChange={(e) => setMsg({ ...msg, coupon: e.target.value })} placeholder="300" /></label>
            <label className="field" style={{ margin: 0 }}><span>有効日数</span><input type="number" min={1} max={365} value={msg.days} onChange={(e) => setMsg({ ...msg, days: e.target.value })} /></label>
          </div>
        </div>
        <label className="field" style={{ margin: 0 }}><span>本文</span><textarea value={msg.body} maxLength={400} onChange={(e) => setMsg({ ...msg, body: e.target.value })} placeholder="例: 湖が凍りはじめました。窓際の席を温めて待っています。" /></label>
        <button className="btn primary" disabled={!msg.title || !msg.body || (aud !== null && aud.selected === 0)} onClick={async () => {
          try {
            const r = await post<{ sent_to: number }>(`/admin/shops/${shopId}/messages`, {
              title: msg.title, body: msg.body,
              coupon_face_value: msg.coupon ? Number(msg.coupon) : null, coupon_days: msg.coupon ? Number(msg.days) : null,
              stages: stages.length ? stages : null,
            });
            toast(`${r.sent_to} 人に届けました`);
            setMsg({ title: "", body: "", coupon: "", days: "60" });
            await load(shopId);
          } catch (e) { toast((e as Error).message, "error"); }
        }}>{aud ? `${aud.selected} 人に便りを送る` : "便りを送る"}</button>
        {d.messages.length > 0 && (
          <table className="tbl">
            <thead><tr><th>日付</th><th>件名</th><th>クーポン</th><th className="num">届いた人</th></tr></thead>
            <tbody>{d.messages.map((m) => <tr key={m.id}><td>{m.created_at.slice(0, 10).replace(/-/g, "/")}</td><td>{m.title}</td><td>{m.coupon_face_value ? `${m.coupon_face_value} 円引き・${m.coupon_days} 日` : "—"}</td><td className="num">{m.sent_to}</td></tr>)}</tbody>
          </table>
        )}
      </div>
        </>
      )}
    </div>
  );
}

/** 運営の窓 › お店・施設の人向け: 自分の店の編集（写真・おすすめ）、来訪のダッシュボード（地域平均との比較）、イベントのお知らせ、旅行者への便り。 */
import { useEffect, useRef, useState } from "react";
import { get, post, put, sendForm, toast } from "../api";
import { BarChart, Stat } from "../components/charts";

type ShopRow = { id: number; name: string; area: string; category: string; person_name?: string | null };
type ShopDash = {
  shop: { id: number; name: string; area: string; category: string; description: string; access: string; rate_percent: number; spot_id: number; recommend: string | null; photo_url: string | null };
  person: { id: number; name: string; role: string } | null;
  months: string[];
  series: { month: string; meetings: number; spend: number; visitors: number; meetings_area_avg: number; meetings_island_avg: number; spend_area_avg: number; spend_island_avg: number }[];
  relationships: { first: number; again: number; regular: number };
  upcoming_events: { id: number; date: string; title: string; kind: string; expected: number | null; note: string | null }[];
  upcoming_visits: { date: string; plans: number }[];
  messages: { id: number; title: string; body: string; coupon_face_value: number | null; coupon_days: number | null; created_at: string; sent_to: number }[];
  coupons_used: { count: number; amount: number };
  reach: number;
};

export function ShopPanel() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [shopId, setShopId] = useState<number>(() => Number(localStorage.getItem("hitomeguri.admin.shop") || 4));
  const [d, setD] = useState<ShopDash | null>(null);
  const [edit, setEdit] = useState({ description: "", access: "", recommend: "" });
  const [msg, setMsg] = useState({ title: "", body: "", coupon: "", days: "60" });
  const fileRef = useRef<HTMLInputElement>(null);
  const load = async (id: number) => {
    const dd = await get<ShopDash>(`/admin/shops/${id}/dashboard`);
    setD(dd);
    setEdit({ description: dd.shop.description ?? "", access: dd.shop.access ?? "", recommend: dd.shop.recommend ?? "" });
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
  if (!d) return <p className="muted">読み込み中…</p>;
  const labels = d.series.map((s) => s.month);
  const cur = d.series[d.series.length - 1];
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

      <div className="grid2" style={{ alignItems: "start" }}>
        <div>
          <h2>これから来る人・イベント</h2>
          <div className="card">
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
        <div>
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
            <label className="field" style={{ margin: 0 }}><span>アクセス</span><input type="text" value={edit.access} maxLength={120} onChange={(e) => setEdit({ ...edit, access: e.target.value })} /></label>
            <button className="btn primary" onClick={async () => { try { await put(`/admin/shops/${shopId}`, edit); toast("保存しました"); await load(shopId); } catch (e) { toast((e as Error).message, "error"); } }}>保存する</button>
          </div>
        </div>
      </div>

      <h2>旅行者への便り（{d.person ? `${d.person.name}から` : "お店から"}）</h2>
      <div className="card stack">
        <div className="muted small">
          あなたに会ったことのある旅行者 <b>{d.reach} 人</b>に届きます。クーポンを添えると、その人のクーポンにすぐ入ります（補填の対象）。
          これまでに使われたクーポン: {d.coupons_used.count} 枚・{d.coupons_used.amount.toLocaleString()} 円。
        </div>
        <div className="grid2">
          <label className="field" style={{ margin: 0 }}><span>件名</span><input type="text" value={msg.title} maxLength={60} onChange={(e) => setMsg({ ...msg, title: e.target.value })} placeholder="例: 雪見ぜんざい、はじめました" /></label>
          <div className="grid2">
            <label className="field" style={{ margin: 0 }}><span>クーポン（円引き、空なら無し）</span><input type="number" min={100} max={10000} step={100} value={msg.coupon} onChange={(e) => setMsg({ ...msg, coupon: e.target.value })} placeholder="300" /></label>
            <label className="field" style={{ margin: 0 }}><span>有効日数</span><input type="number" min={1} max={365} value={msg.days} onChange={(e) => setMsg({ ...msg, days: e.target.value })} /></label>
          </div>
        </div>
        <label className="field" style={{ margin: 0 }}><span>本文</span><textarea value={msg.body} maxLength={400} onChange={(e) => setMsg({ ...msg, body: e.target.value })} placeholder="例: 湖が凍りはじめました。窓際の席を温めて待っています。" /></label>
        <button className="btn primary" disabled={!msg.title || !msg.body} onClick={async () => {
          try {
            const r = await post<{ sent_to: number }>(`/admin/shops/${shopId}/messages`, { title: msg.title, body: msg.body, coupon_face_value: msg.coupon ? Number(msg.coupon) : null, coupon_days: msg.coupon ? Number(msg.days) : null });
            toast(`${r.sent_to} 人に届けました`);
            setMsg({ title: "", body: "", coupon: "", days: "60" });
            await load(shopId);
          } catch (e) { toast((e as Error).message, "error"); }
        }}>便りを送る</button>
        {d.messages.length > 0 && (
          <table className="tbl">
            <thead><tr><th>日付</th><th>件名</th><th>クーポン</th><th className="num">届いた人</th></tr></thead>
            <tbody>{d.messages.map((m) => <tr key={m.id}><td>{m.created_at.slice(0, 10).replace(/-/g, "/")}</td><td>{m.title}</td><td>{m.coupon_face_value ? `${m.coupon_face_value} 円引き・${m.coupon_days} 日` : "—"}</td><td className="num">{m.sent_to}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

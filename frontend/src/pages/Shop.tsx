import { useEffect, useState } from "react";
import { get, post, toast } from "../api";
import { navigate } from "../router";
import { Avatar, Photo } from "../components/parts";
import { Badge, Loading, TopBar } from "../components/ui";

type Coupon = { id: number; category: string; name: string; face_value: number; valid_from: string; valid_until: string };
type ShopView = {
  shop: { id: number; name: string; area: string; category: string; description: string; access: string; rate_percent: number; spot_id: number };
  place: { id: number; name: string; image: string } | null;
  hours: string;
  forecast: { label: string; reason: string };
  person: { id: number; name: string; intro: string; role: string; image: string } | null;
  coupons_usable: Coupon[];
  coupons_not_yet: Coupon[];
};

export function ShopPage({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const [v, setV] = useState<ShopView | null>(null);
  const load = async () => setV(await get<ShopView>(`/shops/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!v) return <div className="page"><Loading /></div>;
  const use = async (c: Coupon) => {
    try {
      await post(`/coupons/${c.id}/use`, { shop_id: id });
      toast(`${c.name} を使いました。${v.person ? v.person.name : "お店の人"}に見せてください`);
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      <TopBar title={v.shop.name} backTo="/wallet" />
      {v.place && <Photo src={v.place.image} alt={v.place.name} ratio="3 / 1" caption={v.shop.name} sub={`${v.place.name}・${v.shop.area}`} />}
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <Badge>{v.shop.category}</Badge>
        <Badge strong>{v.forecast.label}</Badge>
        <Badge soft>還元 {v.shop.rate_percent}%</Badge>
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
        <button className="btn ghost small" onClick={() => navigate(`/place/${v.shop.spot_id}`)}>この場所の画面へ</button>
      </div>
      <p>{v.shop.description}</p>
      <p className="muted small">営業 {v.hours}・{v.forecast.reason}</p>
      {v.person && (
        <button className="card row" style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/people/${v.person!.id}`)}>
          <Avatar p={v.person} />
          <div className="grow">
            <div className="title" style={{ fontSize: "1rem" }}>{v.person.name} <span className="muted small">{v.person.role}</span></div>
            <div className="muted small">{v.person.intro}</div>
          </div>
        </button>
      )}
      <h2>ここで使えるクーポン</h2>
      {v.coupons_usable.length === 0 && <p className="muted">いま使えるクーポンはありません。</p>}
      <div className="stack">
        {v.coupons_usable.map((c) => (
          <div key={c.id} className="card letter">
            <div className="title" style={{ fontSize: "1rem" }}>{c.name}</div>
            <div className="muted small">有効期限 {c.valid_until.replace(/-/g, "/")}</div>
            <button className="btn primary block" onClick={() => { if (confirm(`${c.name} を使用済みにします。お店の人の前で押してください。`)) use(c); }}>このクーポンを使う</button>
            <p className="muted small" style={{ margin: "6px 0 0" }}>お店の人の前で押してください。使用済みになります。</p>
          </div>
        ))}
      </div>
      {v.coupons_not_yet.length > 0 && (
        <p className="muted small">次の来訪から使えるクーポン: {v.coupons_not_yet.map((c) => `${c.name}（${c.valid_from.replace(/-/g, "/")}〜）`).join("、")}</p>
      )}
    </div>
  );
}

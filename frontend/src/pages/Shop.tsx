import { useEffect, useState } from "react";
import { get, post, toast } from "../api";
import { navigate } from "../router";
import { PersonArt, SceneArt } from "../components/art";
import { Badge, Loading, LongPressButton, TopBar } from "../components/ui";

type Coupon = { id: number; category: string; name: string; face_value: number; valid_from: string; valid_until: string };
type ShopView = {
  shop: { id: number; name: string; area: string; category: string; description: string; access: string; svg_key: string; is_unmanned: number; rate_percent: number };
  hours: string;
  forecast: { label: string; reason: string };
  person: { id: number; name: string; intro: string; svg_key: string } | null;
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
      toast(`${c.name} を使いました。お店の人に見せてください`);
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      <TopBar title={v.shop.name} backTo="/" />
      <SceneArt k={v.shop.svg_key} />
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <Badge>{v.shop.category}</Badge>
        <Badge kind="good">{v.forecast.label}</Badge>
        <Badge kind="seed">還元 {v.shop.rate_percent}%</Badge>
      </div>
      <p>{v.shop.description}</p>
      <p className="muted">{v.shop.area}・営業 {v.hours}・{v.forecast.reason}</p>
      {v.person && (
        <div className="card row">
          <div className="avatar"><PersonArt k={v.person.svg_key} /></div>
          <div className="grow">
            <div className="title">{v.person.name}</div>
            <div className="muted">{v.person.intro}</div>
          </div>
        </div>
      )}
      <h2>ここで使えるクーポン</h2>
      {v.coupons_usable.length === 0 && <p className="muted">いま使えるクーポンはありません。</p>}
      <div className="stack">
        {v.coupons_usable.map((c) => (
          <div key={c.id} className="card">
            <div className="title">{c.name}</div>
            <div className="muted">有効期限 {c.valid_until.replace(/-/g, "/")}</div>
            <LongPressButton className="primary block" onComplete={() => use(c)}>
              1.2 秒長押しで使う
            </LongPressButton>
            <p className="muted" style={{ margin: "6px 0 0" }}>お店の人の前で長押ししてください。使用済みになります。</p>
          </div>
        ))}
      </div>
      {v.coupons_not_yet.length > 0 && (
        <p className="muted">
          次の来訪から使えるクーポン: {v.coupons_not_yet.map((c) => `${c.name}（${c.valid_from.replace(/-/g, "/")}〜）`).join("、")}
        </p>
      )}
      <button className="btn block ghost" style={{ marginTop: 12 }} onClick={() => navigate(`/place/shop/${id}`)}>お店の紹介・季節の約束</button>
    </div>
  );
}

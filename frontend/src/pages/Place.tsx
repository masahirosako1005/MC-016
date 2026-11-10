/** 場所の画面。旅前は紹介と「行きたい」。旅中はここで 会えた → AR フォト → レシート → クーポン をまとめて行う。 */
import { useEffect, useState } from "react";
import { del, get, post, toast } from "../api";
import { useT } from "../i18n";
import { navigate, useRoute } from "../router";
import { Avatar, PersonLine, Photo } from "../components/parts";
import { Mascot } from "../components/mascots";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
import { Badge, Loading, TopBar } from "../components/ui";
import type { PlaceCard, PlaceInfo } from "./Plan";

type Coupon = { id: number; category: string; name: string; face_value: number; valid_from: string; valid_until: string };
type ShopView = { shop: { id: number; name: string; category: string; rate_percent: number }; coupons_usable: Coupon[]; coupons_not_yet: Coupon[] };

export function PlacePage({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const t = useT();
  const [pl, setPl] = useState<PlaceCard | null>(null);
  const [help, setHelp] = useState(0);
  const load = async () => setPl(await get<PlaceCard>(`/places/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!pl) return <div className="page"><Loading /></div>;
  const onTrip = pl.status === "open" || pl.met_today || pl.people.some((p) => p.forecast.status === "closing_soon");
  const refresh = async () => {
    await load();
    onChanged?.();
  };
  const toggle = async () => {
    try {
      if (pl.in_plan) await del(`/plan/items/spot/${pl.id}`);
      else await post("/plan/items", { kind: "spot", target_id: pl.id });
      toast(pl.in_plan ? "行きたいからはずしました" : `「${pl.name}」を行きたいに入れました`);
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      {onTrip && <Tutorial id="place" steps={TIPS.place} trigger={help} />}
      <TopBar title={pl.name} backTo={onTrip ? "/" : "/plan"} right={onTrip ? <HelpButton onClick={() => setHelp((n) => n + 1)} /> : undefined} />
      <Photo src={pl.image} alt={pl.name} caption={pl.name} sub={`${pl.area}・${pl.best_season_label}が見ごろ${onTrip ? `・${pl.status_label}` : ""}`}>
        {pl.in_plan && <span className="badge flower" style={{ position: "absolute", top: 10, left: 10 }}>{onTrip ? "きょう行く場所" : "行きたい"}</span>}
      </Photo>
      {!onTrip && (
        <>
          <p style={{ marginTop: 12 }}>{pl.description}</p>
          {pl.recommend && <p className="small" style={{ color: "#7a5300" }}>★ お店からのおすすめ: {pl.recommend}</p>}
          <p className="muted small">アクセス: {pl.access}</p>
          <button className={`btn block ${pl.in_plan ? "done" : "primary mark"}`} onClick={toggle}>{pl.in_plan ? `${t("want_done")}（はずす）` : t("want_button")}</button>
          {pl.info && pl.info.length > 0 && <TravelInfo items={pl.info} />}
        </>
      )}
      {onTrip && pl.info && pl.info.length > 0 && (
        <details className="card" style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>住所・電話・行き方</summary>
          <TravelInfo items={pl.info} bare />
        </details>
      )}

      <h2>{t("people_here")}</h2>
      <div className="stack">
        {pl.people.map((p) =>
          onTrip ? (
            <PersonAction key={p.id} p={p} placeId={pl.id} onChange={refresh} />
          ) : (
            <div key={p.id} className="card">
              <PersonLine p={p} onClick={() => navigate(`/people/${p.id}`)} />
              <p className="muted small" style={{ margin: "4px 0 0" }}>{p.intro}</p>
              <div className="muted small">{p.shop.name}・{p.shop.hours}</div>
            </div>
          ),
        )}
      </div>

      {/* AR フォトの記録は、撮るボタン（上の人のカード）のすぐ下に。新しい 3 枚 */}
      <div className="histhead">ここで撮った AR フォト{pl.photo_count ? `（${pl.photo_count} 枚）` : ""}</div>
      {pl.photos && pl.photos.length > 0 ? (
        <>
          <div className="grid3">
            {pl.photos.slice(0, 3).map((p) => (
              <button key={p.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer", textAlign: "left" }} onClick={() => navigate(`/photo/${p.id}?from=${pl.id}`)}>
                <img src={p.url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
                <div className="muted small" style={{ marginTop: 2 }}>{p.taken_on.slice(5).replace("-", "/")}{p.is_sample ? "・サンプル" : ""}</div>
              </button>
            ))}
          </div>
          {(pl.photo_count ?? 0) > 3 && <button className="btn ghost small block" style={{ marginTop: 8 }} onClick={() => navigate("/book")}>ほかの {(pl.photo_count ?? 0) - 3} 枚はアルバムで</button>}
        </>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>まだありません。ここの人に会えた日に、ほしまると撮れます。</p>
      )}

      <h2>レシートでポイント</h2>
      {onTrip && (
        <div className="card stack">
          <button className="btn primary block" onClick={() => navigate(`/receipt/${pl.id}`)}>レシートを撮る</button>
          <p className="muted small" style={{ margin: 0 }}>撮るだけで店名と金額を読み取ります（AI-OCR）。確認して登録するとポイントに。</p>
        </div>
      )}
      {/* レシートの記録は、撮るボタンのすぐ下に。新しい 5 件の表 */}
      <div className="histhead">ここでのお買いもの{pl.receipts && pl.receipts.count > 0 ? `（${pl.receipts.count} 件・${pl.receipts.total.toLocaleString()} 円）` : ""}</div>
      {pl.receipts && pl.receipts.count > 0 ? (
        <div className="card" style={{ padding: "6px 10px" }}>
          <table className="tbl">
            <thead><tr><th>日付</th><th>お店</th><th className="num">金額</th><th className="num">pt</th></tr></thead>
            <tbody>
              {pl.receipts.rows.map((r) => (
                <tr key={r.id}><td style={{ whiteSpace: "nowrap" }}>{r.date.slice(5).replace("-", "/")}</td><td>{r.shop_name}</td><td className="num">{r.amount.toLocaleString()} 円</td><td className="num">{r.points}</td></tr>
              ))}
              <tr><th colSpan={2}>合計{pl.receipts.count > pl.receipts.rows.length ? `（全 ${pl.receipts.count} 件）` : ""}</th><th className="num">{pl.receipts.total.toLocaleString()} 円</th><th className="num">{pl.receipts.points}</th></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>まだありません。{onTrip ? "レシートを撮ると、ここに記録が並びます。" : "旅の日にレシートを撮ると、ここに記録が並びます。"}</p>
      )}

      {onTrip && (
        <>
          <h2>クーポンを使う</h2>
          <div className="stack">
            {pl.people.map((p) => <ShopCoupons key={p.shop.id} shopId={p.shop.id} shopName={p.shop.name} personName={p.name} onChange={refresh} />)}
          </div>
        </>
      )}

      {pl.voices && pl.voices.length > 0 && (
        <>
          <h2>{t("voices")}</h2>
          <div className="stack">
            {pl.voices.map((v) => (
              <div key={v.id} className="card letter">
                <div className="row between"><span className="muted small">{v.author}</span><Badge soft>{v.season_label}</Badge></div>
                <div>{v.text}</div>
                <div className="muted small">{v.hashtags}</div>
              </div>
            ))}
            <p className="muted small">デモ用の内部データです。本番では SNS 公式 API 等に差し替える前提です。</p>
          </div>
        </>
      )}
      {onTrip && <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => navigate("/")}>マップにもどる</button>}
    </div>
  );
}

export function PersonAction({ p, placeId, onChange }: { p: PlaceCard["people"][number]; placeId: number; onChange: () => Promise<void> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const canMeet = p.forecast.status === "open" || p.forecast.status === "closing_soon";
  const meet = async () => {
    setBusy(true);
    try {
      const r = await post<{ already: boolean; relationship: { label: string; days: number } }>("/meetings", { person_id: p.id });
      if (!r.already) toast(`${r.relationship.label}！ ${p.name}に会えたのは ${r.relationship.days} 回目です`);
      await onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ padding: 12 }}>
      <button className="row" style={{ background: "none", border: 0, padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/people/${p.id}`)}>
        <Avatar p={p} met={p.met_today} dim={!canMeet && !p.met_today} />
        <div className="grow">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="title" style={{ fontSize: "1rem" }}>{p.name}</span>
            <span className="muted small">{p.role}</span>
            {p.relationship && p.relationship.stage !== "none" && <span className={`badge rank-${p.relationship.stage}`}>{p.relationship.label}</span>}
          </div>
          <div className="muted small">{p.shop?.name}・{p.forecast.reason}</div>
          {p.event && <div className="small" style={{ color: "var(--ai-700)", fontWeight: 700 }}>{p.event.label}</div>}
        </div>
      </button>
      <div style={{ marginTop: 10 }}>
        {!p.met_today ? (
          <button className={`btn block ${canMeet ? "primary mark" : "ghost"}`} disabled={busy || !canMeet} onClick={meet}>
            {canMeet ? `${p.name}に${t("met_button")}` : p.forecast.label}
          </button>
        ) : (
          <button className="btn primary block mark" onClick={() => navigate(`/camera/person/${p.id}?from=${placeId}`)}>ほしまると {t("ar_photo").replace("いっしょに ", "")}</button>
        )}
      </div>
    </div>
  );
}

function ShopCoupons({ shopId, shopName, personName, onChange }: { shopId: number; shopName: string; personName: string; onChange: () => Promise<void> }) {
  const [v, setV] = useState<ShopView | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const load = async () => setV(await get<ShopView>(`/shops/${shopId}`));
  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);
  if (!v) return null;
  const use = async (c: Coupon) => {
    try {
      await post(`/coupons/${c.id}/use`, { shop_id: shopId });
      toast(`${c.name} を使いました。${personName}に見せてください`);
      setConfirmId(null);
      await load();
      await onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="card">
      <div className="row between">
        <span style={{ fontWeight: 700 }}>{shopName}</span>
        <Badge soft>{v.shop.category}・還元 {v.shop.rate_percent}%</Badge>
      </div>
      {v.coupons_usable.length === 0 ? (
        <div className="muted small" style={{ marginTop: 4 }}>
          ここで使えるクーポンはありません。{v.coupons_not_yet.length > 0 ? `次の来訪から: ${v.coupons_not_yet.map((c) => c.name).join("、")}` : ""}
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 8 }}>
          {v.coupons_usable.map((c) => (
            <div key={c.id} className="card letter" style={{ padding: 10 }}>
              <div className="row between"><span style={{ fontWeight: 700 }}>{c.name}</span><span className="muted small">〜{c.valid_until.replace(/-/g, "/")}</span></div>
              {confirmId === c.id ? (
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn ghost grow small" onClick={() => setConfirmId(null)}>やめる</button>
                  <button className="btn primary grow small" onClick={() => use(c)}>使用済みにする</button>
                </div>
              ) : (
                <button className="btn primary block small" style={{ marginTop: 8 }} onClick={() => setConfirmId(c.id)}>このクーポンを使う</button>
              )}
              <p className="muted small" style={{ margin: "6px 0 0" }}>{personName}の前で押してください。使用済みになります。</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PersonDetail = PlaceCard["people"][number] & {
  promises: { id: number; season_label: string; title: string; note: string; start_md: string | null; end_md: string | null; current: boolean }[];
  voices: { id: number; season_label: string; author: string; text: string; hashtags: string }[];
  photos: { id: number; url: string }[];
  fulfilled: { title: string; season_label: string; fulfilled_on: string }[];
  place: { id: number; name: string; area: string; image: string; in_plan: boolean } | null;
};

export function PersonPage({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const t = useT();
  const fromBook = useRoute().query.get("from") === "book"; // ひとめぐり帖からは「記録を見るだけ」
  const [p, setP] = useState<PersonDetail | null>(null);
  const load = async () => setP(await get<PersonDetail>(`/people/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!p) return <div className="page"><Loading /></div>;
  const canMeet = p.forecast.status === "open" || p.forecast.status === "closing_soon";
  const wantPlace = async () => {
    if (!p.place) return;
    try {
      await post("/plan/items", { kind: "spot", target_id: p.place.id });
      toast(`${p.name}のいる「${p.place.name}」を行きたいに入れました`);
      await load();
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="page">
      <TopBar title={p.name} backTo={fromBook ? "/book" : p.place ? `/place/${p.place.id}` : "/plan"} />
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar p={p} size="lg" met={p.met_today} />
        <div className="grow">
          <div className="title" style={{ fontSize: "1.4rem" }}>{p.name}</div>
          <div className="muted">{p.role}・{p.shop.name}</div>
          {p.relationship && p.relationship.stage !== "none" && <span className={`badge rank-${p.relationship.stage}`}>{p.relationship.label}（会えた {p.relationship.days} 回）</span>}
          <p style={{ margin: "6px 0 0" }}>{p.intro}</p>
        </div>
      </div>
      {p.place && (
        <div style={{ marginTop: 12 }}>
          <Photo src={p.place.image} alt={p.place.name} ratio="3 / 1" caption={p.place.name} sub={`${p.place.area}・${p.shop.hours}${p.shop.closed_weekday !== null && p.shop.closed_weekday !== undefined ? `・${"月火水木金土日"[p.shop.closed_weekday]}曜定休` : "・無休"}`} onClick={() => navigate(`/place/${p.place!.id}`)} />
        </div>
      )}
      {(p.shop.address || p.shop.nearest || p.shop.notes) && (
        <TravelInfo
          items={[{ shop_id: p.shop.id, shop_name: p.shop.name, category: p.shop.category, hours: p.shop.hours,
            closed: p.shop.closed_weekday !== null && p.shop.closed_weekday !== undefined ? `${"月火水木金土日"[p.shop.closed_weekday]}曜定休` : "無休",
            address: p.shop.address ?? null, phone: p.shop.phone ?? null, url: p.shop.url ?? null, nearest: p.shop.nearest ?? null, notes: p.shop.notes ?? null }]}
        />
      )}
      {/* 「会えた」は旅の途中、場所の画面でだけ押せる。ここは人の紹介と記録 */}
      {!fromBook && (
        <div style={{ marginTop: 10 }}>
          {canMeet || p.met_today ? (
            <button className="btn primary block mark" onClick={() => p.place && navigate(`/place/${p.place.id}`)}>{p.place?.name}の画面へ（会えた・AR フォト）</button>
          ) : p.place?.in_plan ? (
            <button className="btn done block">{p.place.name}は行きたいに入っています</button>
          ) : (
            <button className="btn primary block mark" onClick={wantPlace}>{p.place?.name}を行きたいに入れる</button>
          )}
        </div>
      )}
      {p.place && (
        <div className="card row" style={{ marginTop: 10 }}>
          <Mascot k={MASCOT_BY_SPOT[p.place.id] ?? "lighthouse"} size={72} />
          <div className="grow small">この場所のほしまる。{p.name}に会えた日は、いっしょに AR フォトが撮れます。</div>
        </div>
      )}
      <h2>{t("promises")}</h2>
      <div className="card stack">
        {p.promises.map((pr) => (
          <div key={pr.id} className="row" style={{ opacity: pr.current ? 1 : 0.75 }}>
            <Badge strong={pr.current}>{pr.season_label}</Badge>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{pr.title}</div>
              <div className="muted small">{pr.note}{pr.start_md ? `（${pr.start_md.replace("-", "/")}〜${pr.end_md?.replace("-", "/")}）` : ""}</div>
            </div>
          </div>
        ))}
        {p.fulfilled.length > 0 && <div className="muted small">果たした約束: {p.fulfilled.map((f) => `${f.season_label}「${f.title}」`).join("、")}</div>}
      </div>
      {p.voices.length > 0 && (
        <>
          <h2>{t("voices")}</h2>
          <div className="stack">
            {p.voices.map((v) => (
              <div key={v.id} className="card letter">
                <div className="row between"><span className="muted small">{v.author}</span><Badge soft>{v.season_label}</Badge></div>
                <div>{v.text}</div>
                <div className="muted small">{v.hashtags}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {p.photos.length > 0 && (
        <>
          <h2>この場所で撮った一枚</h2>
          <div className="grid3">
            {p.photos.map((ph) => (
              <button key={ph.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }} onClick={() => navigate(`/photo/${ph.id}?from=${p.place?.id ?? ""}`)}>
                <img src={ph.url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const MASCOT_BY_SPOT: Record<number, string> = { 1: "lighthouse", 2: "cape", 3: "market", 4: "lake", 5: "windmill", 6: "street", 7: "hall" };

/** 旅行に関係する情報（住所・電話・営業時間・最寄り・行き方・ひとこと）。店ごとに 1 ブロック。 */
export function TravelInfo({ items, bare = false }: { items: PlaceInfo[]; bare?: boolean }) {
  const body = items.map((i) => (
    <div key={i.shop_id} className="stack" style={{ gap: 2, marginTop: bare ? 8 : 0 }}>
      {items.length > 1 && <div style={{ fontWeight: 700 }}>{i.shop_name}</div>}
      <InfoRow k="住所" v={i.address} />
      <InfoRow k="電話" v={i.phone} />
      <InfoRow k="営業" v={`${i.hours}・${i.closed}`} />
      <InfoRow k="最寄り" v={i.nearest} />
      {i.url && <InfoRow k="Web" v={i.url} />}
      <InfoRow k="メモ" v={i.notes} />
    </div>
  ));
  if (bare) return <>{body}</>;
  return (
    <div className="card stack" style={{ marginTop: 10, gap: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <img src="/img/mascot/ui/hoshimaru_point.png" alt="" width={36} height={36} />
        <div style={{ fontWeight: 700 }}>行き方と連絡先</div>
      </div>
      {body}
    </div>
  );
}
function InfoRow({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="row small" style={{ alignItems: "flex-start", gap: 8 }}>
      <span className="muted" style={{ minWidth: 44 }}>{k}</span>
      <span className="grow" style={{ wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}

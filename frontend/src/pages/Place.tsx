/** 場所の画面。旅前は紹介と「行きたい」。旅中はここで 会えた → AR フォト → レシート → クーポン をまとめて行う。 */
import { useEffect, useState } from "react";
import { ApiError, del, get, post, sendForm, toast } from "../api";
import { useT } from "../i18n";
import { navigate } from "../router";
import type { Seed } from "../types";
import { Avatar, PersonLine, Photo } from "../components/parts";
import { CameraCapture } from "../components/capture";
import { Mascot } from "../components/mascots";
import { SeedIcon } from "../components/art";
import { HelpButton, TIPS, Tutorial } from "../components/tutorial";
import { Badge, Loading, TopBar } from "../components/ui";
import type { PlaceCard } from "./Plan";

type Coupon = { id: number; category: string; name: string; face_value: number; valid_from: string; valid_until: string };
type ShopView = { shop: { id: number; name: string; category: string; rate_percent: number }; coupons_usable: Coupon[]; coupons_not_yet: Coupon[] };

export function PlacePage({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const t = useT();
  const [pl, setPl] = useState<PlaceCard | null>(null);
  const [help, setHelp] = useState(0);
  const [bloom, setBloom] = useState<{ title: string; next: Seed | null } | null>(null);
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
        </>
      )}

      <h2>{t("people_here")}</h2>
      <div className="stack">
        {pl.people.map((p) =>
          onTrip ? (
            <PersonAction key={p.id} p={p} placeId={pl.id} onChange={refresh} onBloom={(b) => setBloom(b)} />
          ) : (
            <div key={p.id} className="card">
              <PersonLine p={p} onClick={() => navigate(`/people/${p.id}`)} />
              <p className="muted small" style={{ margin: "4px 0 0" }}>{p.intro}</p>
              <div className="muted small">{p.shop.name}・{p.shop.hours}</div>
            </div>
          ),
        )}
      </div>

      {onTrip && (
        <>
          <h2>レシートでポイント</h2>
          <ReceiptCapture shops={pl.people.map((p) => p.shop)} onDone={refresh} />
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
      {pl.photos && pl.photos.length > 0 && (
        <>
          <h2>ここで撮った一枚</h2>
          <div className="grid3">
            {pl.photos.map((p) => (
              <button key={p.id} style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }} onClick={() => navigate(`/photo/${p.id}?from=${pl.id}`)}>
                <img src={p.url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
              </button>
            ))}
          </div>
        </>
      )}
      {onTrip && <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => navigate("/")}>マップにもどる</button>}
      {bloom && <Bloom title={bloom.title} next={bloom.next} onClose={() => setBloom(null)} />}
    </div>
  );
}

export function Bloom({ title, next, onClose }: { title: string; next: Seed | null; onClose: () => void }) {
  return (
    <div className="bloom" role="dialog" aria-modal="true">
      <div className="inner">
        <svg viewBox="0 0 120 120" width="140" height="140" aria-hidden="true">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <ellipse key={a} cx="60" cy="34" rx="12" ry="24" fill="#e3a21a" opacity=".9" transform={`rotate(${a} 60 60)`} />)}
          <circle cx="60" cy="60" r="14" fill="#fbfcfd" stroke="#1b2a44" strokeWidth="3" />
        </svg>
        <div className="serif" style={{ fontSize: "1.4rem", marginTop: 6 }}>花がさきました</div>
        <p style={{ margin: "6px 0 0" }}>約束「{title}」を果たしました。</p>
        {next && <p className="muted small" style={{ margin: "6px 0 0" }}>つぎは {next.season_label}の約束「{next.title}」。種になりました。</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn ghost grow" onClick={onClose}>とじる</button>
          <button className="btn primary grow" onClick={() => { onClose(); navigate("/book"); }}>ひとめぐり帖で見る</button>
        </div>
      </div>
    </div>
  );
}

export function PersonAction({ p, placeId, onChange, onBloom }: { p: PlaceCard["people"][number]; placeId: number; onChange: () => Promise<void>; onBloom?: (b: { title: string; next: Seed | null }) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const seed = p.seed as Seed | null;
  const canMeet = p.forecast.status === "open" || p.forecast.status === "closing_soon";
  const meet = async () => {
    setBusy(true);
    try {
      const r = await post<{ already: boolean; relationship: { label: string }; new_seed: boolean; seed: Seed | null }>("/meetings", { person_id: p.id });
      if (!r.already) toast(r.new_seed && r.seed ? `${r.relationship.label}！ ${r.seed.season_label}の約束「${r.seed.title}」が種になりました` : `${r.relationship.label}！`);
      await onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const fulfill = async () => {
    if (!seed) return;
    try {
      const r = await post<{ next: Seed | null }>(`/seeds/${seed.id}/fulfill`);
      onBloom?.({ title: seed.title, next: r.next });
      await onChange();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "失敗しました", "error");
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
            {p.relationship && p.relationship.stage !== "none" && <Badge>{p.relationship.label}</Badge>}
          </div>
          <div className="muted small">{p.shop?.name}・{p.forecast.reason}</div>
          {p.event && <div className="small" style={{ color: "var(--ai-700)", fontWeight: 700 }}>{p.event.label}</div>}
          {seed && (
            <div className="row small" style={{ gap: 6, marginTop: 4 }}>
              <SeedIcon state={seed.state} size={18} />
              <span>{seed.season_label}の約束「{seed.title}」{seed.state === "flower" ? "が咲いています" : "（つぼみ）"}</span>
            </div>
          )}
        </div>
      </button>
      <div style={{ marginTop: 10 }}>
        {!p.met_today ? (
          <button className={`btn block ${canMeet ? "primary mark" : "ghost"}`} disabled={busy || !canMeet} onClick={meet}>
            {canMeet ? `${p.name}に${t("met_button")}` : p.forecast.label}
          </button>
        ) : seed?.can_fulfill ? (
          <button className="btn primary block mark" onClick={fulfill}>約束「{seed.title}」を果たす</button>
        ) : (
          <button className="btn primary block mark" onClick={() => navigate(`/camera/person/${p.id}?from=${placeId}`)}>ほしまると {t("ar_photo").replace("いっしょに ", "")}</button>
        )}
        {p.met_today && seed?.can_fulfill && (
          <button className="btn ghost block small" style={{ marginTop: 6 }} onClick={() => navigate(`/camera/person/${p.id}?from=${placeId}`)}>ほしまると AR フォト</button>
        )}
      </div>
    </div>
  );
}

/** レシート撮影 → AI-OCR 風の読み取り演出 → 確認して登録。 */
function ReceiptCapture({ shops, onDone }: { shops: PlaceCard["people"][number]["shop"][]; onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "camera" | "scan" | "confirm" | "saving">("idle");
  const [shopId, setShopId] = useState(shops[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    get<{ demo_mode: boolean }>("/health").then((h) => setDemo(h.demo_mode)).catch(() => undefined);
  }, []);
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];
  const amt = Number(amount);
  const pts = shop && amt > 0 ? Math.floor((amt * 10) / 100) : 0;
  const onFile = (f: File, objectUrl?: string) => {
    setFile(f);
    setUrl(objectUrl ?? URL.createObjectURL(f));
    setPhase("scan");
    setTimeout(() => {
      // デモ: 読み取り結果として店と金額の候補を出す（本番は AI-OCR の結果が入る）
      if (demo && !amount) setAmount("1200");
      setPhase("confirm");
    }, 1900);
  };
  const submit = async () => {
    if (!file || !shop) return;
    if (!(amt >= 1 && amt <= 100000 && Number.isInteger(amt))) {
      toast("金額を 1〜100,000 円の整数で確認してください", "error");
      return;
    }
    setPhase("saving");
    try {
      const fd = new FormData();
      fd.append("shop_id", String(shop.id));
      fd.append("amount", String(amt));
      fd.append("image", file);
      const r = await sendForm<{ points: number; balance: number }>("/receipts", fd);
      toast(`${r.points} pt もらいました（合計 ${r.balance} pt）`);
      setFile(null);
      setUrl(null);
      setAmount("");
      setPhase("idle");
      await onDone();
    } catch (e) {
      toast((e as Error).message, "error");
      setPhase("confirm");
    }
  };
  return (
    <div className="card stack">
      {phase === "idle" && (
        <>
          <button className="btn primary block" onClick={() => setPhase("camera")}>レシートを撮る</button>
          <p className="muted small" style={{ margin: 0 }}>撮るだけで店名と金額を読み取ります（AI-OCR）。確認して登録するとポイントに。画像は 7 日で削除されます。</p>
        </>
      )}
      {phase === "camera" && <CameraCapture hint="レシート全体を枠に入れて、シャッターを押してください" onCapture={(f, u) => onFile(f, u)} onCancel={() => setPhase("idle")} />}
      {url && phase !== "idle" && phase !== "camera" && (
        <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#000" }}>
          <img src={url} alt="レシート" style={{ width: "100%", maxHeight: 260, objectFit: "contain", display: "block", opacity: phase === "scan" ? 0.8 : 1 }} />
          {phase === "scan" && (
            <>
              <div className="scanline" />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(27,42,68,.8)", color: "#fff", padding: "6px 10px", fontSize: ".85rem" }}>AI-OCR で読み取り中… 店名・金額・日付を探しています</div>
            </>
          )}
          {phase !== "scan" && (
            <>
              <div className="ocr-box" style={{ left: "10%", top: "18%", width: "60%", height: "9%" }} />
              <div className="ocr-box" style={{ left: "45%", top: "62%", width: "45%", height: "10%", animationDelay: ".15s" }} />
            </>
          )}
        </div>
      )}
      {(phase === "confirm" || phase === "saving") && (
        <>
          <div className="row between"><span className="small" style={{ fontWeight: 700 }}>読み取り結果{demo ? "（デモ）" : ""}</span><Badge flower>確認してください</Badge></div>
          <label className="field">
            <span>お店（読み取り: この場所のお店）</span>
            <select value={shopId} onChange={(e) => setShopId(Number(e.target.value))}>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>金額（円）{demo && amount ? "・読み取り値" : ""}</span>
            <input type="number" inputMode="numeric" min={1} max={100000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="読み取れませんでした。入力してください" />
          </label>
          {pts > 0 && <div className="muted small">もらえるポイント: 約 {pts} pt（店の還元率で計算）</div>}
          <div className="row">
            <button className="btn ghost grow" onClick={() => { setPhase("idle"); setFile(null); setUrl(null); }}>撮り直す</button>
            <button className="btn primary grow mark" disabled={phase === "saving"} onClick={submit}>この内容で登録</button>
          </div>
        </>
      )}
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
  const [p, setP] = useState<PersonDetail | null>(null);
  const [bloom, setBloom] = useState<{ title: string; next: Seed | null } | null>(null);
  const load = async () => setP(await get<PersonDetail>(`/people/${id}`));
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!p) return <div className="page"><Loading /></div>;
  const seed = p.seed as Seed | null;
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
      <TopBar title={p.name} backTo={p.place ? `/place/${p.place.id}` : "/plan"} />
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar p={p} size="lg" met={p.met_today} />
        <div className="grow">
          <div className="title" style={{ fontSize: "1.4rem" }}>{p.name}</div>
          <div className="muted">{p.role}・{p.shop.name}</div>
          {p.relationship && p.relationship.stage !== "none" && <Badge>{p.relationship.label}（会えた日 {p.relationship.days} 日）</Badge>}
          <p style={{ margin: "6px 0 0" }}>{p.intro}</p>
        </div>
      </div>
      {p.place && (
        <div style={{ marginTop: 12 }}>
          <Photo src={p.place.image} alt={p.place.name} ratio="3 / 1" caption={p.place.name} sub={`${p.place.area}・${p.shop.hours}${p.shop.closed_weekday !== null && p.shop.closed_weekday !== undefined ? `・${"月火水木金土日"[p.shop.closed_weekday]}曜定休` : "・無休"}`} onClick={() => navigate(`/place/${p.place!.id}`)} />
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        {canMeet || p.met_today ? (
          <PersonAction p={p} placeId={p.place?.id ?? p.spot_id} onChange={async () => { await load(); onChanged?.(); }} onBloom={setBloom} />
        ) : p.place?.in_plan ? (
          <button className="btn done block">{p.place.name}は行きたいに入っています</button>
        ) : (
          <button className="btn primary block mark" onClick={wantPlace}>{p.place?.name}を行きたいに入れる</button>
        )}
      </div>
      {seed && (
        <div className="card row" style={{ marginTop: 10 }}>
          <SeedIcon state={seed.state} size={32} />
          <div className="grow">
            <Badge flower={seed.state === "flower"}>{seed.state === "flower" ? t("seed_flower") : t("seed_bud")}</Badge> {seed.season_label}の約束「{seed.title}」
            <div className="muted small">{seed.hint}</div>
          </div>
        </div>
      )}
      {p.place && (
        <div className="card row" style={{ marginTop: 10 }}>
          <Mascot k={MASCOT_BY_SPOT[p.place.id] ?? "toudai"} size={72} />
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
      {bloom && <Bloom title={bloom.title} next={bloom.next} onClose={() => setBloom(null)} />}
    </div>
  );
}

export const MASCOT_BY_SPOT: Record<number, string> = { 1: "toudai", 2: "hoshimi", 3: "yoichi", 4: "kohan", 5: "kazaguruma", 6: "ishidatami", 7: "ongakudo" };

/** 共通部品: いまやること・ステップ帯・人カード・場所カード・初回ガイド・写真枠。 */
import { useEffect, useState, type ReactNode } from "react";
import { navigate } from "../router";
import { Badge } from "./ui";

export type Todo = { kind: string; text: string; button: string | null; path: string | null; place_id?: number };

export function TodoCard({ todo, onButton }: { todo: Todo; onButton?: () => void }) {
  return (
    <div className="todo">
      <div className="label">いまやること</div>
      <div className="text">{todo.text}</div>
      {todo.button && (
        <button className="btn block" onClick={() => (onButton ? onButton() : todo.path && navigate(todo.path))}>
          {todo.button}
        </button>
      )}
    </div>
  );
}

export function Steps({ items, current }: { items: string[]; current: number }) {
  return (
    <div className="steps" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }} aria-label="手順">
      {items.map((s, i) => (
        <div key={s} className={i === current ? "on" : i < current ? "done" : ""}>{i + 1}. {s}</div>
      ))}
    </div>
  );
}

export function Photo({ src, alt, ratio = "3 / 2", caption, sub, children, onClick }: { src: string; alt: string; ratio?: string; caption?: ReactNode; sub?: ReactNode; children?: ReactNode; onClick?: () => void }) {
  return (
    <div className="photo-wrap" style={{ aspectRatio: ratio, cursor: onClick ? "pointer" : undefined }} onClick={onClick} role={onClick ? "button" : undefined}>
      <img src={src} alt={alt} loading="lazy" />
      <div className="tint" />
      {(caption || sub) && (
        <div className="caption">
          {caption && <div className="name">{caption}</div>}
          {sub && <div className="sub">{sub}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export type PersonLite = {
  id: number; name: string; role: string; image: string; intro?: string; season_note?: string;
  shop?: { name: string; hours?: string };
  forecast?: { status: string; label: string; reason: string };
  met_today?: boolean; relationship?: { days: number; stage: string; label: string };
  event?: { label: string } | null;
};

export function Avatar({ p, size = "md", dim, met }: { p: { image: string; name: string }; size?: "sm" | "md" | "lg"; dim?: boolean; met?: boolean }) {
  return (
    <div className={`avatar ${size === "sm" ? "sm" : size === "lg" ? "lg" : ""} ${dim ? "dim" : ""} ${met ? "met" : ""}`}>
      <img src={p.image} alt={p.name} loading="lazy" />
    </div>
  );
}

/** 旅前用: 「ここにいる人」。ボタンは付けない（付加情報）。 */
export function PersonLine({ p, onClick }: { p: PersonLite; onClick?: () => void }) {
  return (
    <button className="row" style={{ background: "none", border: 0, padding: "6px 0", textAlign: "left", cursor: "pointer", width: "100%" }} onClick={onClick}>
      <Avatar p={p} size="sm" />
      <div className="grow">
        <span style={{ fontWeight: 700 }}>{p.name}</span> <span className="muted small">{p.role}{p.shop ? `・${p.shop.name}` : ""}</span>
        {p.season_note && <div className="muted small">{p.season_note}</div>}
      </div>
      <span className="muted" aria-hidden="true">›</span>
    </button>
  );
}

const GUIDE_KEY = "hitomeguri.guide.v2";
const GUIDE = [
  { no: "一", title: "この島には、会いに行ける人がいます", body: "お店の人、案内所の人、灯台のガイド。まずは「計画」で行きたい場所を選ぶと、そこにいる人が分かります。" },
  { no: "二", title: "会えたら「会えた」を押す", body: "旅の日は「マップ」。行った先の人に会えたら押してください。次の季節の約束が「種」になり、いっしょに AR フォトも撮れます。" },
  { no: "三", title: "季節が変わると、花が咲く", body: "その夜「思い出」に便りが届きます。次の季節に花が咲いたら、また会いに行って約束を果たしましょう。クーポンは次の旅で使えます。" },
];

export function FirstGuide() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    try {
      if (!localStorage.getItem(GUIDE_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
    const on = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("hitomeguri:guide", on);
    return () => window.removeEventListener("hitomeguri:guide", on);
  }, []);
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  const g = GUIDE[i];
  return (
    <div className="guide-backdrop" role="dialog" aria-modal="true" aria-label="使い方">
      <div className="guide">
        <div className="no">{g.no}</div>
        <h3>{g.title}</h3>
        <p style={{ margin: 0 }}>{g.body}</p>
        <div className="dots">{GUIDE.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
        <div className="row">
          <button className="btn ghost grow" onClick={close}>とじる</button>
          {i < GUIDE.length - 1 ? (
            <button className="btn primary grow" onClick={() => setI(i + 1)}>つぎへ</button>
          ) : (
            <button className="btn primary grow" onClick={() => { close(); navigate("/plan"); }}>計画をはじめる</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function showGuide() {
  window.dispatchEvent(new Event("hitomeguri:guide"));
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const strong = status === "open" || status === "closing_soon";
  return <Badge strong={strong} soft={!strong}>{label}</Badge>;
}

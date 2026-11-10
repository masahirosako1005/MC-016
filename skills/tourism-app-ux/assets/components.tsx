/**
 * 部品の見本（React 18 + TypeScript。ルーターや UI のライブラリは使わない）。
 * tokens.css と base.css を読み込んだうえで使う。
 * そのまま 1 ファイルで置いてもよいし、router / ui / parts に分けてもよい。
 * 文言とタブの中身は題材に合わせて書き換える。
 */
import { useEffect, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* ハッシュルーター: `#/plan` `#/place/3` のような URL。サーバー設定が要らない */
/* ------------------------------------------------------------------ */
export function currentPath(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}
export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo(0, 0);
}
export function usePath(): string {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}
/** `/place/:id` のような型に合えば、値を取り出す。 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/");
  const b = path.split("?")[0].split("/");
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* いまやること: 各タブの一番上。文 1 つ + 主ボタン 1 つ                    */
/* サーバーが利用者の状態から 1 つ決めて返す。することがなければ button は null */
/* ------------------------------------------------------------------ */
export type Todo = { kind: string; text: string; button: string | null; path: string | null };

export function TodoCard({ todo, mascot, onButton }: { todo: Todo; mascot?: ReactNode; onButton?: () => void }) {
  return (
    <div className="todo">
      <div>
        <div className="label">いまやること</div>
        <div className="text" style={{ marginBottom: todo.button ? 10 : 0 }}>{todo.text}</div>
        {todo.button && (
          <button className="btn block" onClick={() => (onButton ? onButton() : todo.path && navigate(todo.path))}>
            {todo.button}
          </button>
        )}
      </div>
      {mascot}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 手順帯: 「1. 選ぶ → 2. 整える → 3. 日を決める」                         */
/* ------------------------------------------------------------------ */
export function Steps({ items, current }: { items: string[]; current: number }) {
  return (
    <div className="steps" aria-label="手順">
      {items.map((s, i) => (
        <div key={s} className={i === current ? "on" : i < current ? "done" : ""} aria-current={i === current ? "step" : undefined}>
          {i + 1}. {s}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ヘッダ: 上に固定。戻る先は「ひとつ前」ではなく、その作業の起点を渡す        */
/* ------------------------------------------------------------------ */
export function TopBar({ title, backTo, right }: { title: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="row">
        {backTo !== undefined && (
          <button className="iconbtn" aria-label="もどる" onClick={() => navigate(backTo)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className="title">{title}</div>
      </div>
      <div className="row">{right}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 下タブ: 5 つまで。1 タブ = 1 目的。名前は利用者の言葉で                   */
/* ------------------------------------------------------------------ */
export type Tab = { path: string; label: string; icon: ReactNode; unread?: boolean };

export function TabBar({ tabs, path }: { tabs: Tab[]; path: string }) {
  return (
    <nav className="tabbar" aria-label="メニュー">
      {tabs.map((t) => {
        const on = t.path === "/" ? path === "/" : path.startsWith(t.path);
        return (
          <button key={t.path} className={on ? "on" : ""} aria-current={on ? "page" : undefined} onClick={() => navigate(t.path)}>
            {t.icon}
            <span>{t.label}</span>
            {t.unread && <i className="dot" aria-label="新着あり" />}
          </button>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* お知らせ: どこからでも toast("…") で出せる。短い 1 文、3 秒で消える        */
/* ------------------------------------------------------------------ */
type ToastKind = "info" | "error";
const listeners = new Set<(msg: string, kind: ToastKind) => void>();
export function toast(msg: string, kind: ToastKind = "info") {
  listeners.forEach((f) => f(msg, kind));
}

export function Toasts() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  useEffect(() => {
    const on = (msg: string, kind: ToastKind) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, msg, kind }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
    };
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);
  return (
    <>
      {items.map((t, i) => (
        <div key={t.id} className={`toast ${t.kind}`} role="status" style={{ bottom: `calc(var(--tab-h) + ${16 + i * 52}px)` }}>
          {t.msg}
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 初回ガイド: 3 枚。1 枚 = 見出し 1 つ + 図 1 つ + 2 行                    */
/* 見たかどうかは端末に保存。保存できない環境でも動くよう try/catch で囲む      */
/* ------------------------------------------------------------------ */
export type GuidePage = { no: string; title: string; body: string; figure?: ReactNode };

export function FirstGuide({ storageKey, pages, startLabel, startPath }: { storageKey: string; pages: GuidePage[]; startLabel: string; startPath: string }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      /* 保存できなくても続ける */
    }
    // 設定の「使い方をもう一度見る」から出し直す: window.dispatchEvent(new Event("app:guide"))
    const on = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("app:guide", on);
    return () => window.removeEventListener("app:guide", on);
  }, [storageKey]);
  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* 保存できなくても続ける */
    }
    setOpen(false);
  };
  const g = pages[i];
  const last = i === pages.length - 1;
  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="使い方">
      <div className="guide">
        <div className="no">{g.no}</div>
        <h3>{g.title}</h3>
        {g.figure && <div className="figure">{g.figure}</div>}
        <p style={{ margin: 0 }}>{g.body}</p>
        <div className="dots" aria-hidden="true">
          {pages.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="row">
          <button className="btn ghost grow" onClick={close}>とじる</button>
          {/* 最後のボタンは、最初にやる画面へ連れて行く */}
          <button className="btn primary grow" onClick={() => (last ? (close(), navigate(startPath)) : setI(i + 1))}>
            {last ? startLabel : "つぎへ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 確認つきの操作: 大事な操作は長押しではなく「ボタン → 確認」               */
/* ------------------------------------------------------------------ */
export function ConfirmButton({ label, question, yes, onConfirm, className = "btn" }: { label: ReactNode; question: string; yes: string; onConfirm: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="backdrop" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="serif" style={{ fontSize: "1.1rem", margin: "0 0 14px" }}>{question}</p>
            <div className="row">
              <button className="btn ghost grow" onClick={() => setOpen(false)}>やめる</button>
              <button className="btn primary grow" onClick={() => { setOpen(false); onConfirm(); }}>{yes}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 空の状態・読み込み中: 一言と、次にできること                             */
/* ------------------------------------------------------------------ */
export function Empty({ text, mascot, action }: { text: string; mascot?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card stack" style={{ alignItems: "center", textAlign: "center" }}>
      {mascot}
      <div className="muted">{text}</div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 組み立ての例                                                         */
/* ------------------------------------------------------------------ */
/*
const TABS: Tab[] = [
  { path: "/plan", label: "計画", icon: <PlanIcon /> },
  { path: "/", label: "マップ", icon: <MapIcon /> },
  { path: "/memories", label: "思い出", icon: <LetterIcon />, unread: true },
  { path: "/book", label: "手帖", icon: <BookIcon /> },
  { path: "/wallet", label: "クーポン", icon: <TicketIcon /> },
];

export function App() {
  const path = usePath();
  const place = match("/place/:id", path);
  return (
    <div className="app">
      <main className="page">
        {path === "/plan" && <PlanPage />}
        {path === "/" && <MapPage />}
        {place && <PlacePage id={Number(place.id)} />}
      </main>
      <TabBar tabs={TABS} path={path} />
      <Toasts />
      <FirstGuide storageKey="myapp.guide.v1" pages={GUIDE} startLabel="計画をはじめる" startPath="/plan" />
    </div>
  );
}
*/

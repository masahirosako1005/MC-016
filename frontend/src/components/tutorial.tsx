/** 都度チュートリアル。画面ごとに 1 回出る（localStorage）。ヘッダの「？」でいつでも再表示。図解は自前 SVG。 */
import { useEffect, useState, type ReactNode } from "react";

const KEY = "hitomeguri.tips.v1";

function readSeen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function markSeen(k: string) {
  try {
    const s = readSeen();
    s[k] = true;
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export type TipStep = { title: string; body: string; figure: ReactNode };

export function Tutorial({ id, steps, trigger }: { id: string; steps: TipStep[]; trigger?: number }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    let guideDone = true;
    try {
      guideDone = !!localStorage.getItem("hitomeguri.guide.v2");
    } catch {
      /* ignore */
    }
    if (!readSeen()[id] && guideDone) setOpen(true);
    // 初回ガイドが閉じられたら、この画面の使い方を出す
    const on = () => {
      if (!readSeen()[id]) setOpen(true);
    };
    window.addEventListener("hitomeguri:guide-closed", on);
    return () => window.removeEventListener("hitomeguri:guide-closed", on);
  }, [id]);
  useEffect(() => {
    if (trigger) {
      setI(0);
      setOpen(true);
    }
  }, [trigger]);
  if (!open) return null;
  const s = steps[i];
  const close = () => {
    markSeen(id);
    setOpen(false);
  };
  return (
    <div className="guide-backdrop" role="dialog" aria-modal="true" aria-label="使い方">
      <div className="guide">
        <div className="no">つかいかた {i + 1}/{steps.length}</div>
        <h3>{s.title}</h3>
        <div className="figure">{s.figure}</div>
        <p style={{ margin: 0 }}>{s.body}</p>
        <div className="dots">{steps.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
        <div className="row">
          <button className="btn ghost grow" onClick={close}>とじる</button>
          {i < steps.length - 1 ? (
            <button className="btn primary grow" onClick={() => setI(i + 1)}>つぎへ</button>
          ) : (
            <button className="btn primary grow" onClick={close}>はじめる</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="iconbtn" aria-label="使い方" onClick={onClick} style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1.2rem" }}>
      ？
    </button>
  );
}

/* ---------- 図解（共通の小さな SVG 部品） ---------- */
const F = { w: 320, h: 150 };
const ai = "#1b2a44";
const ai3 = "#a9b4c8";
const ai1 = "#e6eaf1";
const yama = "#e3a21a";
const paper = "#fbfcfd";

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${F.w} ${F.h}`} width="100%" style={{ display: "block", background: paper, border: `1px solid ${ai1}`, borderRadius: 8 }} aria-hidden="true">
      {children}
    </svg>
  );
}
function Phone({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="70" height="120" rx="10" fill="#fff" stroke={ai} strokeWidth="2" />
      {children}
    </g>
  );
}
function Card({ x, y, w = 50, h = 40, img = true }: { x: number; y: number; w?: number; h?: number; img?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="4" fill="#fff" stroke={ai3} />
      {img && <rect x="4" y="4" width={w - 8} height={h * 0.5} rx="2" fill={ai1} />}
      <rect x="4" y={h * 0.5 + 8} width={w - 12} height="4" rx="2" fill={ai3} />
    </g>
  );
}
function Finger({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="9" fill={yama} opacity=".35" />
      <circle r="4" fill={yama} />
    </g>
  );
}
function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g stroke={ai} strokeWidth="2" fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={`${x2},${y2} ${x2 - 6 * Math.sign(x2 - x1 || 1)},${y2 - 4} ${x2 - 6 * Math.sign(x2 - x1 || 1)},${y2 + 4}`} fill={ai} />
    </g>
  );
}
function Label({ x, y, children, color = ai }: { x: number; y: number; children: ReactNode; color?: string }) {
  return <text x={x} y={y} fontSize="11" fill={color} fontFamily="'Yu Gothic UI', sans-serif" fontWeight="700">{children}</text>;
}
function Person({ x, y, met }: { x: number; y: number; met?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="10" fill={met ? ai : ai1} stroke={ai} strokeWidth="1.5" />
      <circle cy="-3" r="3.5" fill={met ? paper : ai3} />
      <path d="M-6 6 q6 -6 12 0" fill={met ? paper : ai3} />
      {met && <circle cx="9" cy="-9" r="4" fill={yama} />}
    </g>
  );
}

export const TIPS = {
  plan: [
    {
      title: "カードを左右にスワイプ",
      body: "場所のカードが 1 枚ずつ出ます。右へスワイプで「行く」、左へスワイプで「行かない」。下のボタンでも選べます。",
      figure: (
        <Frame>
          <Card x={135} y={25} w={50} h={70} />
          <Arrow x1={125} y1={60} x2={60} y2={60} />
          <Arrow x1={195} y1={60} x2={260} y2={60} />
          <Label x={30} y={85}>行かない</Label>
          <Label x={250} y={85} color={yama}>行く</Label>
          <Finger x={160} y={100} />
        </Frame>
      ),
    },
    {
      title: "地図で確かめて、整える",
      body: "全部選び終わると、行きたい場所が地図に並びます。ピンをタップすると外したり戻したりできます。",
      figure: (
        <Frame>
          <ellipse cx="160" cy="80" rx="120" ry="50" fill={ai1} />
          {[[90, 70], [150, 55], [210, 85], [250, 65]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0 0 l-8 -14 a8 8 0 1 1 16 0z" fill={i === 2 ? ai3 : yama} />
            </g>
          ))}
          <Finger x={210} y={95} />
          <Label x={200} y={125}>タップで外す／戻す</Label>
        </Frame>
      ),
    },
    {
      title: "日を決めると、カレンダーへ",
      body: "行く日を決めると、その日に会えそうな人が分かり、Google カレンダーに予定を入れられます。お店の人にも「その日に来る」が伝わります。",
      figure: (
        <Frame>
          <rect x="40" y="30" width="90" height="90" rx="6" fill="#fff" stroke={ai} strokeWidth="2" />
          <rect x="40" y="30" width="90" height="18" rx="6" fill={ai} />
          <text x="85" y="88" fontSize="26" textAnchor="middle" fill={ai} fontFamily="'Yu Mincho', serif" fontWeight="700">24</text>
          <Arrow x1={140} y1={75} x2={190} y2={75} />
          <Person x={220} y={60} met />
          <Person x={250} y={85} met />
          <Label x={200} y={125}>会えそうな人</Label>
        </Frame>
      ),
    },
  ],
  map: [
    {
      title: "地図の見かた",
      body: "山吹色の番号ピンが「きょう行く場所」。青い点が現在地。会えた場所はチェックが付いて薄くなります。",
      figure: (
        <Frame>
          <ellipse cx="160" cy="80" rx="130" ry="55" fill={ai1} />
          <g transform="translate(100 70)"><path d="M0 0 l-10 -18 a10 10 0 1 1 20 0z" fill={yama} /><text y="-13" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">1</text></g>
          <g transform="translate(170 60)"><path d="M0 0 l-10 -18 a10 10 0 1 1 20 0z" fill={yama} /><text y="-13" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">2</text></g>
          <g transform="translate(240 85)" opacity=".6"><path d="M0 0 l-10 -18 a10 10 0 1 1 20 0z" fill={ai} /><path d="M-4 -19 l3 3 l6 -6" stroke="#fff" strokeWidth="2" fill="none" /></g>
          <circle cx="120" cy="100" r="7" fill="#4a90e2" stroke="#fff" strokeWidth="2" />
          <circle cx="120" cy="100" r="14" fill="#4a90e2" opacity=".2" />
          <Label x={20} y={135}>山吹=きょう行く／✓=会えた／青=現在地</Label>
        </Frame>
      ),
    },
    {
      title: "場所をタップすると、その場所の画面へ",
      body: "そこにいる人に「会えた」、ゆるキャラと AR フォト、レシートの撮影、クーポンの利用は、場所の画面でまとめて行います。",
      figure: (
        <Frame>
          <ellipse cx="80" cy="75" rx="60" ry="40" fill={ai1} />
          <g transform="translate(85 70)"><path d="M0 0 l-10 -18 a10 10 0 1 1 20 0z" fill={yama} /></g>
          <Finger x={92} y={80} />
          <Arrow x1={150} y1={75} x2={190} y2={75} />
          <Phone x={200} y={15}>
            <rect x="6" y="8" width="58" height="26" rx="3" fill={ai1} />
            <rect x="6" y="40" width="58" height="12" rx="3" fill={ai} />
            <rect x="6" y="56" width="58" height="12" rx="3" fill="#fff" stroke={ai3} />
            <rect x="6" y="72" width="58" height="12" rx="3" fill="#fff" stroke={ai3} />
            <rect x="6" y="88" width="58" height="12" rx="3" fill="#fff" stroke={ai3} />
          </Phone>
          <Label x={10} y={135}>会えた・AR・レシート・クーポン</Label>
        </Frame>
      ),
    },
  ],
  place: [
    {
      title: "会えたら「会えた」を押す",
      body: "その人に会えたら押してください。次の季節の約束が「種」になり、同じ日に AR フォトが撮れるようになります。",
      figure: (
        <Frame>
          <Person x={70} y={70} />
          <Arrow x1={95} y1={70} x2={135} y2={70} />
          <Person x={165} y={70} met />
          <Arrow x1={190} y1={70} x2={230} y2={70} />
          <g transform="translate(260 70)"><path d="M0 14 C0 6 0 2 0 -2" stroke="#3b7d3a" strokeWidth="2" /><path d="M0 2 q-8 -2 -7 -9 q7 0 7 9z" fill="#8bc34a" /><ellipse cy="-6" rx="4" ry="5.5" fill="#8a6d3b" /></g>
          <Label x={40} y={120}>会う</Label>
          <Label x={140} y={120}>会えた</Label>
          <Label x={235} y={120}>種をもらう</Label>
        </Frame>
      ),
    },
    {
      title: "AR フォトは、その場所のゆるキャラと",
      body: "島の各地区にいる架空のゆるキャラが、その場所・その季節の衣装で写真に入ります。ここで、きょうだけ撮れる一枚です。",
      figure: (
        <Frame>
          <rect x="60" y="20" width="200" height="110" rx="6" fill={ai1} />
          <circle cx="200" cy="85" r="26" fill={paper} stroke={ai} strokeWidth="2" />
          <circle cx="190" cy="80" r="2.5" fill={ai} /><circle cx="210" cy="80" r="2.5" fill={ai} />
          <path d="M194 92 q6 5 12 0" stroke={ai} strokeWidth="2" fill="none" />
          <path d="M180 108 q20 8 40 0 l0 8 q-20 6 -40 0z" fill={ai} />
          <Label x={80} y={45} color={paper}>　</Label>
          <Label x={70} y={125}>風景 + ゆるキャラ + 日付</Label>
        </Frame>
      ),
    },
    {
      title: "レシートは撮るだけ",
      body: "レシートを撮ると、読み取り（AI-OCR）が店名と金額を推定します。確認して登録すると、ポイントがたまります。",
      figure: (
        <Frame>
          <rect x="60" y="25" width="60" height="100" rx="4" fill="#fff" stroke={ai3} />
          {[40, 55, 70, 85, 100].map((y) => <rect key={y} x="68" y={y} width="44" height="4" rx="2" fill={ai1} />)}
          <rect x="60" y="60" width="60" height="3" fill={yama} />
          <Arrow x1={130} y1={75} x2={175} y2={75} />
          <rect x="185" y="45" width="110" height="60" rx="6" fill="#fff" stroke={ai} strokeWidth="2" />
          <Label x={195} y={65}>湖畔カフェ 水鏡</Label>
          <Label x={195} y={90} color={yama}>1,200 円 → 120 pt</Label>
        </Frame>
      ),
    },
  ],
  memories: [
    {
      title: "その日の夜、思い出が届く",
      body: "会えた人・AR フォト・行った場所がコルクボードに貼られます。一言日記と、次の旅の提案に「行きたい」を押せます。",
      figure: (
        <Frame>
          <rect x="30" y="20" width="260" height="110" rx="4" fill="#d9b98a" />
          <g transform="translate(60 40) rotate(-6)"><rect width="60" height="50" fill="#fff" /><rect x="5" y="5" width="50" height="34" fill={ai1} /><circle cx="30" cy="2" r="4" fill="#d9534f" /></g>
          <g transform="translate(140 35) rotate(4)"><rect width="60" height="50" fill="#fff" /><rect x="5" y="5" width="50" height="34" fill={ai3} /><circle cx="30" cy="2" r="4" fill={yama} /></g>
          <g transform="translate(215 45) rotate(-3)"><rect width="60" height="50" fill="#fff" /><rect x="5" y="5" width="50" height="34" fill={ai1} /><circle cx="30" cy="2" r="4" fill={ai} /></g>
          <Label x={100} y={122} color={paper}>10/24 の思い出</Label>
        </Frame>
      ),
    },
    {
      title: "30 日後に、便りが届く",
      body: "旅から 30 日たつと、あの日の思い出と「行きたい」と押した場所をまとめた便りが届きます。次の季節まであと何週間かも分かります。",
      figure: (
        <Frame>
          <rect x="40" y="40" width="110" height="70" rx="4" fill="#fff" stroke={ai} strokeWidth="2" />
          <path d="M40 40 l55 40 l55 -40" stroke={ai} strokeWidth="2" fill="none" />
          <circle cx="150" cy="40" r="8" fill={yama} />
          <Arrow x1={160} y1={75} x2={195} y2={75} />
          <Card x={205} y={35} w={40} h={36} />
          <Card x={250} y={35} w={40} h={36} />
          <Label x={205} y={95}>行きたい場所</Label>
          <Label x={205} y={115}>冬まで あと 1 週間</Label>
        </Frame>
      ),
    },
  ],
  book: [
    {
      title: "会えた人が、帖に増えていく",
      body: "島の 8 人がカードで並びます。会えた人は色がつき、約束を果たすと花が咲きます。全員に会うと帖が完成します。",
      figure: (
        <Frame>
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${40 + i * 65} 35)`}>
              <rect width="52" height="70" rx="6" fill="#fff" stroke={i < 2 ? ai : ai3} strokeWidth={i < 2 ? 2 : 1} />
              <Person x={26} y={30} met={i < 2} />
              {i === 0 && <g transform="translate(40 12)">{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cy="-4" rx="2.4" ry="4" fill={yama} transform={`rotate(${a})`} />)}</g>}
              <rect x="10" y="50" width="32" height="4" rx="2" fill={i < 2 ? ai : ai1} />
            </g>
          ))}
          <rect x="40" y="118" width="240" height="8" rx="4" fill={ai1} />
          <rect x="40" y="118" width="60" height="8" rx="4" fill={yama} />
          <Label x={40} y={145}>2 / 8 人に会えた</Label>
        </Frame>
      ),
    },
  ],
  wallet: [
    {
      title: "クーポンは次の旅で使う",
      body: "レシートでたまったポイントで抽選。当たったクーポンは翌日から、同じ区分のお店で使えます。お店のページで「使う」を押してください。",
      figure: (
        <Frame>
          <rect x="40" y="50" width="70" height="40" rx="4" fill="#fff" stroke={ai} strokeWidth="2" strokeDasharray="4 3" />
          <Label x={50} y={75}>500 円引き</Label>
          <Arrow x1={120} y1={70} x2={160} y2={70} />
          <rect x="170" y="35" width="110" height="70" rx="6" fill={ai1} />
          <rect x="190" y="60" width="70" height="30" rx="4" fill={ai} />
          <text x="225" y="80" fontSize="12" textAnchor="middle" fill={paper} fontWeight="700">使う</text>
          <Label x={175} y={125}>同じ区分のお店で</Label>
        </Frame>
      ),
    },
  ],
} satisfies Record<string, TipStep[]>;

/** 初回ガイド用の図解（3 枚）。 */
export function GuideFigure({ n }: { n: 0 | 1 | 2 }) {
  if (n === 0) {
    return (
      <Frame>
        <ellipse cx="160" cy="80" rx="130" ry="50" fill={ai1} />
        {[[80, 70], [160, 55], [240, 80]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 0 l-9 -16 a9 9 0 1 1 18 0z" fill={yama} />
            <Person x={22} y={-14} />
          </g>
        ))}
        <Label x={90} y={135}>場所を選ぶと、そこにいる人が分かる</Label>
      </Frame>
    );
  }
  if (n === 1) {
    return (
      <Frame>
        <Person x={60} y={70} />
        <Arrow x1={85} y1={70} x2={120} y2={70} />
        <Person x={150} y={70} met />
        <Arrow x1={175} y1={70} x2={210} y2={70} />
        <circle cx="250" cy="70" r="22" fill={paper} stroke={ai} strokeWidth="2" />
        <circle cx="242" cy="66" r="2.5" fill={ai} /><circle cx="258" cy="66" r="2.5" fill={ai} />
        <path d="M244 76 q6 5 12 0" stroke={ai} strokeWidth="2" fill="none" />
        <polygon points="250,40 253,46 259,46 254,50 256,56 250,52 244,56 246,50 241,46 247,46" fill={yama} />
        <Label x={30} y={120}>会う</Label>
        <Label x={125} y={120}>会えた</Label>
        <Label x={215} y={120}>ほしまると AR</Label>
      </Frame>
    );
  }
  return (
    <Frame>
      <g transform="translate(70 75)"><path d="M0 14 V-2" stroke="#3b7d3a" strokeWidth="2" /><ellipse cy="-6" rx="4" ry="5.5" fill="#8a6d3b" /></g>
      <Arrow x1={90} y1={75} x2={125} y2={75} />
      <g transform="translate(160 75)"><path d="M0 16 V0" stroke="#3b7d3a" strokeWidth="2" /><ellipse cy="-4" rx="6" ry="9" fill="#8bc34a" /></g>
      <Arrow x1={185} y1={75} x2={220} y2={75} />
      <g transform="translate(260 72)">{[0, 60, 120, 180, 240, 300].map((a) => <ellipse key={a} cy="-9" rx="5" ry="9" fill={yama} transform={`rotate(${a})`} />)}<circle r="5" fill={paper} stroke={ai} strokeWidth="2" /></g>
      <Label x={50} y={120}>種</Label>
      <Label x={140} y={120}>つぼみ</Label>
      <Label x={230} y={120}>次の季節に花</Label>
    </Frame>
  );
}

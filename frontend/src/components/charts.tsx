/** 小さな SVG グラフ（藍の濃淡 + 山吹の強調。外部ライブラリなし）。1 系列 or 2 系列（自分 vs 平均）。 */
import { useState } from "react";

const AI = "#1b2a44";
const AI3 = "#a9b4c8";
const AI1 = "#e6eaf1";
const YAMA = "#e3a21a";

function fmtNum(v: number, unit: string) {
  if (unit === "円") return `${Math.round(v).toLocaleString()} 円`;
  return `${v}${unit ? " " + unit : ""}`;
}

export function BarChart({ labels, values, compare, unit = "", height = 160, title, compareLabel = "平均" }: { labels: string[]; values: number[]; compare?: number[]; unit?: string; height?: number; title: string; compareLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const padL = 8, padR = 8, padT = 18, padB = 24;
  const max = Math.max(1, ...values, ...(compare ?? []));
  const n = labels.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(28, slot * 0.5);
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max);
  return (
    <div>
      <div className="row between small"><span style={{ fontWeight: 700 }}>{title}</span>{compare && <span className="muted"><i style={{ display: "inline-block", width: 10, height: 10, background: AI, marginRight: 4 }} />自分 <i style={{ display: "inline-block", width: 10, height: 10, background: AI3, marginLeft: 8, marginRight: 4 }} />{compareLabel}</span>}</div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => <line key={f} x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} stroke={AI1} />)}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke={AI3} />
        {labels.map((lb, i) => {
          const cx = padL + slot * i + slot / 2;
          const v = values[i];
          const c = compare?.[i];
          const last = i === n - 1;
          return (
            <g key={lb} onMouseEnter={() => setHover(i)}>
              <rect x={padL + slot * i} y={padT} width={slot} height={height - padT - padB} fill="transparent" />
              {c !== undefined && <rect x={cx - bw / 2 + 4} y={y(c)} width={bw} height={y(0) - y(c)} fill={AI3} rx="3" />}
              <rect x={cx - bw / 2 - (c !== undefined ? 4 : 0)} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} fill={last ? YAMA : AI} rx="3" />
              <text x={cx} y={height - 8} fontSize="9" textAnchor="middle" fill="#56698f">{lb.slice(5)}月</text>
              {(hover === i || (hover === null && last)) && (
                <text x={cx} y={y(Math.max(v, c ?? 0)) - 5} fontSize="9" textAnchor="middle" fill={AI} fontWeight="700">{fmtNum(v, unit)}{c !== undefined ? ` / ${fmtNum(c, unit)}` : ""}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ labels, values, unit = "", height = 160, title }: { labels: string[]; values: number[]; unit?: string; height?: number; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const padL = 8, padR = 8, padT = 18, padB = 24;
  const max = Math.max(1, ...values);
  const n = labels.length;
  const x = (i: number) => padL + ((W - padL - padR) / Math.max(1, n - 1)) * i;
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join(" ");
  const area = `${d} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  return (
    <div>
      <div className="small" style={{ fontWeight: 700 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => <line key={f} x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} stroke={AI1} />)}
        <path d={area} fill={AI} opacity=".08" />
        <path d={d} stroke={AI} strokeWidth="2" fill="none" />
        {values.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - 14} y={padT} width="28" height={height - padT - padB} fill="transparent" />
            <circle cx={x(i)} cy={y(v)} r={i === n - 1 ? 5 : 3.5} fill={i === n - 1 ? YAMA : "#fff"} stroke={AI} strokeWidth="2" />
            <text x={x(i)} y={height - 8} fontSize="9" textAnchor="middle" fill="#56698f">{labels[i].slice(5)}月</text>
            {(hover === i || (hover === null && i === n - 1)) && <text x={x(i)} y={y(v) - 9} fontSize="9" textAnchor="middle" fill={AI} fontWeight="700">{fmtNum(v, unit)}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: 10, borderColor: accent ? "var(--yamabuki)" : undefined }}>
      <div className="muted small">{label}</div>
      <div className="serif" style={{ fontSize: "1.5rem", lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

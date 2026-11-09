"""CSV 取り込み。列名はファイルごとに違うので、ヘッダから種類を判定する。
行ごとに検証し、失敗行は理由付きで返す。INSERT OR IGNORE なので 2 回取り込んでも増えない。
"""
from __future__ import annotations

import csv
import io
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

SATISFACTION = {"大変満足", "やや満足", "普通", "やや不満", "大変不満"}
DT_FMT = "%Y-%m-%d %H:%M:%S"


@dataclass
class ImportResult:
    file: str
    kind: str
    total: int = 0
    ok: int = 0
    inserted: int = 0
    failed: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "kind": self.kind,
            "total": self.total,
            "ok": self.ok,
            "inserted": self.inserted,
            "fail_count": len(self.failed),
            "failed": self.failed[:200],
        }


def detect_kind(headers: list[str]) -> str | None:
    h = set(x.strip() for x in headers)
    if "スポット名" in h and "獲得日時" in h:
        return "spot_visits"
    if "reward_name" in h and "prize_name" in h:
        return "legacy_rewards"
    if "ユーザーID" in h and "登録日時" in h:
        return "users"
    if any(x.startswith("アンケート①") for x in h):
        return "survey_post"
    if any(x.endswith("性別") for x in h) and any(x.endswith("年齢") for x in h) and "user_id" in h:
        return "survey_reg"
    return None


def _col(headers: list[str], *cands: str) -> str | None:
    """候補の列名（完全一致 → 後方一致）を探す。"""
    for c in cands:
        if c in headers:
            return c
    for c in cands:
        for h in headers:
            if h.endswith(c):
                return h
    return None


def _int(v: str, name: str) -> int:
    v = (v or "").strip()
    if not v.isdigit():
        raise ValueError(f"{name} が整数ではありません: {v!r}")
    return int(v)


def _dt(v: str, name: str) -> str:
    v = (v or "").strip()
    try:
        return datetime.strptime(v, DT_FMT).strftime(DT_FMT)
    except ValueError:
        raise ValueError(f"{name} の日時形式が不正です: {v!r}")


def read_csv_text(text: str) -> tuple[list[str], list[dict]]:
    reader = csv.DictReader(io.StringIO(text))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    rows = []
    for raw in reader:
        rows.append({(k or "").strip(): (v or "") for k, v in raw.items()})
    return headers, rows


def import_text(conn: sqlite3.Connection, filename: str, text: str, dry_run: bool = False) -> ImportResult:
    headers, rows = read_csv_text(text)
    kind = detect_kind(headers)
    res = ImportResult(file=filename, kind=kind or "unknown", total=len(rows))
    if kind is None:
        res.failed.append({"row": 0, "reason": f"列名から種類を判定できません: {headers}"})
        return res

    spot_names = {r["name"] for r in conn.execute("SELECT name FROM spots")} if kind == "spot_visits" else set()

    prepared: list[tuple] = []
    for i, row in enumerate(rows, start=2):  # 1 行目はヘッダ
        try:
            prepared.append(_prepare(kind, headers, row, spot_names))
            res.ok += 1
        except ValueError as e:
            res.failed.append({"row": i, "reason": str(e)})

    if dry_run or not prepared:
        return res

    sql = _SQL[kind]
    before = conn.total_changes
    conn.executemany(sql, prepared)
    res.inserted = conn.total_changes - before
    conn.execute(
        "INSERT INTO import_runs(at, file, ok_count, fail_count) VALUES(?,?,?,?)",
        (datetime.now().isoformat(timespec="seconds"), filename, res.ok, len(res.failed)),
    )
    return res


_SQL = {
    "users": "INSERT OR IGNORE INTO users(id,name,gender,age_band,region,registered_at,is_dummy,source) VALUES(?,?,?,?,?,?,0,'csv')",
    "spot_visits": "INSERT OR IGNORE INTO spot_visits(user_id,spot_name,visited_at,lap,source) VALUES(?,?,?,?,'csv')",
    "legacy_rewards": "INSERT OR IGNORE INTO legacy_rewards(user_id,reward_name,prize_name,got_at) VALUES(?,?,?,?)",
    "survey_post": "INSERT OR IGNORE INTO survey_post(user_id,satisfaction,good_point,request) VALUES(?,?,?,?)",
    "survey_reg": "INSERT OR IGNORE INTO survey_reg(user_id,gender,age_band,residence,job,channels) VALUES(?,?,?,?,?,?)",
}


def _prepare(kind: str, headers: list[str], row: dict, spot_names: set[str]) -> tuple:
    if kind == "users":
        uid = _int(row.get("ユーザーID", ""), "ユーザーID")
        name = row.get("ユーザー名", "").strip() or f"user_{uid}"
        reg = _dt(row.get("登録日時", ""), "登録日時")
        return (uid, name, row.get("性別", "").strip() or None, row.get("年代", "").strip() or None,
                row.get("居住地域", "").strip() or None, reg)
    if kind == "spot_visits":
        uid = _int(row.get("ユーザID", ""), "ユーザID")
        spot = row.get("スポット名", "").strip()
        if spot not in spot_names:
            raise ValueError(f"スポット名がマスタにありません: {spot!r}")
        at = _dt(row.get("獲得日時", ""), "獲得日時")
        lap_s = row.get("周回", "1").strip() or "1"
        lap = _int(lap_s, "周回")
        return (uid, spot, at, lap)
    if kind == "legacy_rewards":
        uid = _int(row.get("user_id", ""), "user_id")
        rn = row.get("reward_name", "").strip()
        pn = row.get("prize_name", "").strip()
        if not rn:
            raise ValueError("reward_name が空です")
        at = _dt(row.get("timestamp", ""), "timestamp")
        return (uid, rn, pn, at)
    if kind == "survey_post":
        uid = _int(row.get("user_id", ""), "user_id")
        c1 = _col(headers, "アンケート①(満足度を教えてください)") or next(h for h in headers if h.startswith("アンケート①"))
        c2 = next((h for h in headers if h.startswith("アンケート②")), None)
        c3 = next((h for h in headers if h.startswith("アンケート③")), None)
        sat = row.get(c1, "").strip()
        if sat not in SATISFACTION:
            raise ValueError(f"満足度の値が不正です: {sat!r}")
        return (uid, sat, row.get(c2, "").strip() if c2 else None, row.get(c3, "").strip() if c3 else None)
    if kind == "survey_reg":
        uid = _int(row.get("user_id", ""), "user_id")
        g = _col(headers, "性別")
        a = _col(headers, "年齢")
        r = _col(headers, "居住地")
        j = _col(headers, "職業")
        ch = next((h for h in headers if "何で知りましたか" in h), None)
        age = row.get(a, "").strip() if a else ""
        if age and not (age.endswith("代") or age.endswith("以上")):
            raise ValueError(f"年齢帯の形式が不正です: {age!r}")
        return (uid, row.get(g, "").strip() if g else None, age or None, row.get(r, "").strip() if r else None,
                row.get(j, "").strip() if j else None, row.get(ch, "").strip() if ch else None)
    raise ValueError("未知の種類")


def import_dir(conn: sqlite3.Connection, directory: Path, dry_run: bool = False) -> list[ImportResult]:
    results: list[ImportResult] = []
    if not directory.exists():
        return results
    for p in sorted(directory.glob("*.csv")):
        text = p.read_text(encoding="utf-8-sig")
        results.append(import_text(conn, p.name, text, dry_run=dry_run))
    return results

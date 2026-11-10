"""運営の「次の一手」提案。デモはデータから規則で組み立てる。本番は生成 AI に下書きさせる想定（docs に明記）。
提案 = {priority, title, why, action(label, kind, params)}。格付け・順位は作らない。
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from ..repositories import master
from .operator import dmo_dashboard, shop_dashboard
from .season import LABEL, next_season, season_of, season_start_after


def dmo_advice(conn: sqlite3.Connection, now: datetime) -> list[dict]:
    d = dmo_dashboard(conn, now)
    s = d["summary"]
    out: list[dict] = []
    today = now.date()
    nxt = season_start_after(today)
    weeks = max(0, (nxt - today).days // 7)
    # 1) 次の季節の便り
    bud = conn.execute("SELECT COUNT(DISTINCT user_id) FROM seeds WHERE fulfilled_on IS NULL AND season = ?", (season_of(nxt),)).fetchone()[0]
    if bud:
        out.append({
            "priority": "high", "title": f"{LABEL[season_of(nxt)]}の便りの準備（あと {weeks} 週間）",
            "why": f"{LABEL[season_of(nxt)]}に花になる種を持つ旅行者が {bud} 人います。季節の変わり目は再訪の一番のきっかけです。",
            "action": {"label": "お店に『季節の約束』の便りを促す", "kind": "notice", "params": {}},
        })
    # 2) 満足なのに再訪なし
    sat = conn.execute(
        "SELECT COUNT(*) FROM survey_post sp WHERE sp.satisfaction IN ('大変満足','やや満足') AND sp.user_id NOT IN (SELECT user_id FROM meetings)"
    ).fetchone()[0]
    if sat:
        out.append({
            "priority": "high", "title": "満足したのに人に会っていない旅行者が多い",
            "why": f"参加後アンケートで満足と答えたのに、お店の人に会った記録がない旅行者が {sat} 人。場所の「ここにいる人」を目立たせ、旅前の計画に人を添えると、2 回目につながります。",
            "action": {"label": "旅前カードの『おすすめ』をお店に書いてもらう", "kind": "shops_recommend", "params": {}},
        })
    # 2b) アンケートの「困ったこと」
    from .survey import summary as survey_summary

    sv = survey_summary(conn)
    if not sv["suppressed"]:
        worst = max((t for t in sv["trouble"] if t["key"] != "none"), key=lambda t: t["count"], default=None)
        if worst and worst["count"] >= 3:
            out.append({
                "priority": "high", "title": f"アンケートで「{worst['label']}」の声が {worst['count']} 件",
                "why": f"旅のあとのアンケート（回答 {sv['n']} 件）で、困ったこととして多く挙がっています。声の中身を読んで、案内やお店への共有につなげましょう。",
                "action": {"label": "アンケートの声を読む", "kind": "survey", "params": {}},
            })
    # 3) 消費の偏り
    if d["by_area"]:
        top = max(d["by_area"], key=lambda a: a["total"])
        low = min(d["by_area"], key=lambda a: a["total"])
        if top["total"] > 0 and low["total"] < top["total"] * 0.5:
            out.append({
                "priority": "mid", "title": f"{low['area']}への回遊が弱い",
                "why": f"消費額が最も多い{top['area']}に比べ、{low['area']}は半分以下です。{low['area']}の店のクーポン枠（抽選の重み）を一時的に増やすと、横の誘客になります。",
                "action": {"label": "抽選の重みを調整する", "kind": "prizes", "params": {"area": low["area"]}},
            })
    # 4) イベントの登録
    ev = conn.execute("SELECT COUNT(*) FROM events WHERE date >= ?", (today.isoformat(),)).fetchone()[0]
    if ev == 0:
        out.append({
            "priority": "mid", "title": "今後のイベントが未登録",
            "why": "スポーツの試合や連休など外部起因の来訪増は、お店の仕入れに直結します。分かっているものから登録して知らせましょう。",
            "action": {"label": "イベントのお知らせを登録", "kind": "events", "params": {}},
        })
    # 5) 前月比
    if s["spend_prev_month"] and s["spend_this_month"] < s["spend_prev_month"] * 0.8:
        out.append({
            "priority": "mid", "title": "今月の観光消費が前月より 2 割以上減",
            "why": f"{s['spend_this_month']:,} 円（前月 {s['spend_prev_month']:,} 円）。30 日後の便りが届く旅行者に、次の季節の計画を促す時期です。",
            "action": {"label": "来訪予定を確認", "kind": "visits", "params": {}},
        })
    # 6) 計画→来訪
    plans = conn.execute("SELECT COUNT(*) FROM plans WHERE target_date >= ?", (today.isoformat(),)).fetchone()[0]
    if plans:
        out.append({
            "priority": "low", "title": f"これから来る計画が {plans} 件",
            "why": "計画の日と行き先はお店に共有されています。連絡船の増便や案内所の人員を確認しましょう。",
            "action": {"label": "来訪予定を見る", "kind": "visits", "params": {}},
        })
    return out[:5]


def shop_advice(conn: sqlite3.Connection, shop_id: int, now: datetime) -> list[dict]:
    d = shop_dashboard(conn, shop_id, now)
    sh = d["shop"]
    person = d["person"]
    out: list[dict] = []
    today = now.date()
    season = season_of(today)
    nxt_season = next_season(season)
    nxt = season_start_after(today)
    weeks = max(0, (nxt - today).days // 7)
    aud = audience(conn, shop_id, now)
    pname = person["name"] if person else sh["name"]
    # 1) おなじみの人への季節のごあいさつ
    if aud["stages"]["regular"]:
        out.append({
            "priority": "high", "title": f"おなじみの人が {aud['stages']['regular']} 人",
            "why": f"3 回以上会えている人です。{LABEL[season]}のはじめに一言の便りを送ると、次の計画に入りやすくなります。",
            "action": {"label": "おなじみの人に季節のごあいさつ", "kind": "message", "params": {"stages": ["regular"], "coupon": None, "title": f"{LABEL[season]}のごあいさつ", "body": f"いつもありがとうございます。{LABEL[season]}の{sh['name']}も、お待ちしています。{pname}より"}},
        })
    # 2) また会えたねの人を 3 回目（おなじみ）に
    pr = master.promise(conn, person["id"], nxt_season) if person else None
    if aud["stages"]["again"] and pr:
        out.append({
            "priority": "high", "title": f"また会えたねの人が {aud['stages']['again']} 人（{LABEL[nxt_season]}まで あと {weeks} 週間）",
            "why": f"2 回会えた人は、次で「おなじみ」。{LABEL[nxt_season]}の「{pr['title']}」を先に知らせると、計画を立ててもらえます。",
            "action": {"label": f"『{pr['title']}』の便りを送る", "kind": "message", "params": {"stages": ["again"], "coupon": None, "title": f"{LABEL[nxt_season]}の「{pr['title']}」のお知らせ", "body": f"もうすぐ{LABEL[nxt_season]}。{pr['note']}"}},
        })
    # 3) はじめましての人を 2 回目に
    if aud["stages"]["first"]:
        out.append({
            "priority": "mid", "title": f"一度だけ会った人が {aud['stages']['first']} 人",
            "why": "2 回目に来てもらえるかが分かれ目です。小さなクーポンを添えた便りが効きます。",
            "action": {"label": "はじめましての人にクーポン付きの便り", "kind": "message", "params": {"stages": ["first"], "coupon": 300, "title": "また会えたら、うれしいです", "body": f"先日はありがとうございました。次の季節の約束、覚えていますか。{pname}より"}},
        })
    # 4) 地区平均との比較
    cur = d["series"][-1]
    if cur["meetings_area_avg"] and cur["meetings"] < cur["meetings_area_avg"] * 0.7:
        out.append({
            "priority": "mid", "title": "今月の「会えた」が地区平均より少なめ",
            "why": f"自店 {cur['meetings']} 回・地区平均 {cur['meetings_area_avg']} 回。旅前カードの「おすすめ」と写真を更新すると、計画に入りやすくなります。",
            "action": {"label": "紹介とおすすめを編集", "kind": "edit", "params": {}},
        })
    # 5) イベント
    for ev in d["upcoming_events"][:2]:
        days = (datetime.fromisoformat(ev["date"]).date() - today).days
        if 0 <= days <= 30:
            out.append({
                "priority": "mid", "title": f"{ev['date'][5:].replace('-', '/')} {ev['title']}（あと {days} 日）",
                "why": f"{('見込み ' + format(ev['expected'], ',') + ' 人。') if ev['expected'] else ''}島への便が混みます。仕入れと人手を前倒しで。",
                "action": {"label": "来訪予定とあわせて確認", "kind": "visits", "params": {}},
            })
    # 6) 来訪予定
    if d["upcoming_visits"]:
        v = d["upcoming_visits"][0]
        out.append({
            "priority": "low", "title": f"{v['date'][5:].replace('-', '/')} にこの場所へ来る計画が {v['plans']} 件",
            "why": "計画に入っている旅行者は、その日の「会えた」につながりやすい人です。",
            "action": {"label": "その日の準備をメモ", "kind": "visits", "params": {}},
        })
    if not out:
        out.append({"priority": "low", "title": "まだ会った旅行者がいません", "why": "紹介・おすすめ・写真を整えると、旅前のカードで選ばれやすくなります。", "action": {"label": "紹介を編集", "kind": "edit", "params": {}}})
    return out[:5]


def audience(conn: sqlite3.Connection, shop_id: int, now: datetime, stages: list[str] | None = None, seeds: list[str] | None = None) -> dict:
    """便りの宛先の内訳と、絞り込み後の人数。関係: first/again/regular、種: none/bud/flower。
    時刻は clock から受け取る（デモ時計で「花」になっている人を正しく数えるため）。"""
    person = conn.execute("SELECT id FROM people WHERE shop_id = ?", (shop_id,)).fetchone()
    if not person:
        return {"total": 0, "selected": 0, "stages": {"first": 0, "again": 0, "regular": 0}, "seeds": {"none": 0, "bud": 0, "flower": 0}, "users": []}
    pid = person["id"]
    season = season_of(now.date())
    rows = conn.execute(
        "SELECT m.user_id, COUNT(DISTINCT m.met_on) AS days FROM meetings m WHERE m.person_id = ? AND m.is_dummy = 0 GROUP BY m.user_id", (pid,)
    ).fetchall()
    stage_c = {"first": 0, "again": 0, "regular": 0}
    seed_c = {"none": 0, "bud": 0, "flower": 0}
    users = []
    for r in rows:
        st = "first" if r["days"] == 1 else "again" if r["days"] <= 3 else "regular"
        sd = conn.execute("SELECT season FROM seeds WHERE user_id = ? AND person_id = ? AND fulfilled_on IS NULL", (r["user_id"], pid)).fetchone()
        se = "none" if not sd else ("flower" if sd["season"] == season else "bud")
        stage_c[st] += 1
        seed_c[se] += 1
        if (not stages or st in stages) and (not seeds or se in seeds):
            users.append(r["user_id"])
    return {"total": len(rows), "selected": len(users), "stages": stage_c, "seeds": seed_c, "users": users}


def _unused(_: timedelta) -> None:  # pragma: no cover
    pass

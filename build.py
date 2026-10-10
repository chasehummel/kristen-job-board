#!/usr/bin/env python3
"""Build Kristen's job board (standard library only).

Reads every data/YYYY-MM-DD.json and writes:
  days/YYYY-MM-DD.html  one page per day
  index.html            the latest day
  archive.html          list of all days, newest first
Run:  python3 build.py
"""
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DAYS = ROOT / "days"
INBOX = "kristenbot@mail.grokbot.com"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def esc(s):
    return html.escape(str(s), quote=True)


def d(iso):
    return dt.date.fromisoformat(iso)


def long_date(iso):
    x = d(iso)
    return f"{x:%A}, {x:%B} {x.day}, {x.year}"


def short_date(iso):
    x = d(iso)
    return f"{x:%b} {x.day}"


def load_days():
    days = []
    for p in sorted(DATA.glob("*.json")):
        if not DATE_RE.match(p.stem):
            continue
        with p.open(encoding="utf-8") as f:
            day = json.load(f)
        day.setdefault("date", p.stem)
        if day["date"] != p.stem:
            sys.exit(f"{p.name}: 'date' field ({day['date']}) does not match file name")
        for i, job in enumerate(day.get("jobs", [])):
            for k in ("number", "title", "company", "url"):
                if not job.get(k):
                    sys.exit(f"{p.name}: job {i} is missing required field '{k}'")
        days.append(day)
    days.sort(key=lambda x: x["date"], reverse=True)
    return days


def image_html(img, company, root):
    img = img or {}
    kind = img.get("kind")
    if img.get("src") and kind in ("logo", "photo"):
        src = root + img["src"]
        bg = img.get("bg", "#f3ede3")
        label = (f'<span class="media-label">{esc(img["label"])}</span>'
                 if img.get("label") else "")
        return (f'<div class="media media-{kind}" style="--media-bg:{esc(bg)}">'
                f'<img src="{esc(src)}" alt="{esc(company)}" loading="lazy">'
                f'{label}</div>')
    # Monogram fallback: a typographic tile in brand colors.
    text = img.get("text") or company
    sub = img.get("sub", "")
    bg = img.get("bg", "#2b2a33")
    fg = img.get("fg", "#f5f0e8")
    cls = "mono spaced" if img.get("spaced") else "mono"
    sub_html = f'<span class="mono-sub">{esc(sub)}</span>' if sub else ""
    return (f'<div class="media media-mono" style="--media-bg:{esc(bg)};--media-fg:{esc(fg)}">'
            f'<span class="{cls}">{esc(text)}</span>{sub_html}</div>')


def pill(icon, text, cls=""):
    return f'<li class="pill {cls}"><span class="pi" aria-hidden="true">{icon}</span>{esc(text)}</li>'


def card_html(job, root):
    n = job["number"]
    pills = []
    if job.get("location"):
        pills.append(pill("&#9906;", job["location"]))
    if job.get("work_arrangement"):
        pills.append(pill("&#8962;", job["work_arrangement"]))
    if job.get("salary"):
        pills.append(pill("$", job["salary"], "pill-salary"))
    if job.get("posted"):
        label = job.get("posted_label", "Posted")
        extra = f", {job['posted_extra']}" if job.get("posted_extra") else ""
        pills.append(pill("&#9719;", f"{label} {short_date(job['posted'])}{extra}"))
    if job.get("travel"):
        pills.append(pill("&#9992;", f"Paris travel: {job['travel']}", "pill-travel"))
    rank = (f'<span class="rank">N&ordm; {esc(job["rank"])}</span>' if job.get("rank") else "")
    badges = []
    if job.get("stretch"):
        badges.append('<span class="badge badge-stretch">Stretch</span>')
    if job.get("from_earlier"):
        badges.append('<span class="badge badge-earlier">From earlier</span>')
    stretch_note = (f'<p class="stretch-note"><strong>Why it&rsquo;s a stretch:</strong> {esc(job["stretch_note"])}</p>'
                    if job.get("stretch_note") else "")
    status = (f'<p class="status">{esc(job["status"])}</p>' if job.get("status") else "")
    tie = (f'<p class="tie"><span class="flag" aria-hidden="true"></span>'
           f'<span><strong>French tie</strong> {esc(job["french_tie"])}</span></p>'
           if job.get("french_tie") else "")
    why = (f'<div class="why"><h4>Why it fits you</h4><p>{esc(job["why"])}</p></div>'
           if job.get("why") else "")
    data_attrs = (f'data-number="{esc(n)}" data-title="{esc(job["title"])}" '
                  f'data-company="{esc(job["company"])}" data-url="{esc(job["url"])}"')
    return f'''
<article class="card" id="job-{esc(n)}" {data_attrs}>
  {image_html(job.get("image"), job["company"], root)}
  <div class="card-body">
    <div class="card-top">{rank}<span class="num">#{esc(n)}</span>{"".join(badges)}</div>
    <h3 class="role">{esc(job["title"])}</h3>
    <p class="company">{esc(job["company"])}</p>
    {status}
    <ul class="pills">{"".join(pills)}</ul>
    {tie}
    {why}
    {stretch_note}
    <a class="btn btn-primary" href="{esc(job["url"])}" target="_blank" rel="noopener">View posting <span aria-hidden="true">&rarr;</span></a>
    <details class="fb">
      <summary>Your thoughts on this one</summary>
      <label>What I liked<textarea data-field="liked" rows="3" placeholder="The global team, the brand, the pay&hellip;"></textarea></label>
      <label>What I didn&rsquo;t like<textarea data-field="disliked" rows="3" placeholder="Too much social, too far from LA&hellip;"></textarea></label>
      <label class="check"><input type="checkbox" data-field="resume"> Tailor my resume for this</label>
      <div class="fb-actions">
        <button type="button" class="btn btn-ghost js-send-one">Send feedback</button>
        <span class="saved" aria-live="polite"></span>
      </div>
    </details>
  </div>
</article>'''


def past_days_html(days, current, root):
    items = []
    for day in days:
        cur = ' aria-current="page" class="current"' if day["date"] == current else ""
        title = day.get("title") or "Daily picks"
        n = len(day.get("jobs", []))
        items.append(f'<li><a href="{root}days/{day["date"]}.html"{cur}>'
                     f'<span class="pd-date">{esc(long_date(day["date"]))}</span>'
                     f'<span class="pd-meta">{esc(title)} &middot; {n} pick{"s" if n != 1 else ""}</span></a></li>')
    return f'''
<button type="button" class="pd-tab" aria-controls="pastdays" aria-expanded="false">Past days</button>
<aside id="pastdays" class="pd-drawer" aria-label="Past days" hidden>
  <div class="pd-head"><h2>Past days</h2><button type="button" class="pd-close" aria-label="Close">&times;</button></div>
  <ul>{"".join(items)}</ul>
  <a class="pd-all" href="{root}archive.html">See the full archive</a>
</aside>
<div class="pd-scrim" hidden></div>'''


def head(title, root):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f6f0e6">
<title>{esc(title)}</title>
<link rel="stylesheet" href="{root}assets/fonts.css">
<link rel="stylesheet" href="{root}assets/style.css">
</head>'''


def footer(day=None):
    checked_line = ""
    if day:
        checked = day.get("checked", day["date"])
        checked_line = (f"<p>These listings were checked on {esc(long_date(checked))}. "
                        "Postings can close quickly, so open the link to confirm.</p>")
    return f'''
<footer class="foot">
  <div class="rule" aria-hidden="true"></div>
  {checked_line}
  <p>You can reply by email anytime at <a href="mailto:{INBOX}">{INBOX}</a>. Ask questions, request a resume, or tell me what to look for next.</p>
  <p class="sig">&mdash; Kristen Bot</p>
</footer>'''


def day_page(day, days, root):
    jobs = day.get("jobs", [])
    if jobs and all("rank" in j for j in jobs):
        jobs = sorted(jobs, key=lambda j: j["rank"])
    n = len(jobs)
    title = day.get("title") or "Today's picks"
    intro = f'<p class="intro">{esc(day["intro"])}</p>' if day.get("intro") else ""
    notes = ""
    if day.get("notes"):
        notes = ('<aside class="notes"><h2>Also worth knowing</h2><ul>'
                 + "".join(f"<li>{esc(x)}</li>" for x in day["notes"]) + "</ul></aside>")
    cards = "".join(card_html(j, root) for j in jobs)
    return f'''{head(f"{title} · {long_date(day['date'])}", root)}
<body data-date="{esc(day['date'])}" data-inbox="{INBOX}">
{past_days_html(days, day["date"], root)}
<header class="hero">
  <div class="tricolore" aria-hidden="true"><span></span><span></span><span></span></div>
  <p class="eyebrow">{esc(long_date(day["date"]))}</p>
  <h1>Bonjour, <em>Kristen</em></h1>
  <p class="sub">{esc(title)} &middot; <strong>{n}</strong> pick{"s" if n != 1 else ""} for you</p>
  {intro}
  <p class="hint">Tap <em>Your thoughts on this one</em> on any card to tell me what you liked or didn&rsquo;t, or to ask for a tailored resume. The send button opens your email app with a message ready to go; just hit send. Your notes are saved on this device until then.</p>
</header>
<main class="cards">
{cards}
</main>
<section class="bundle">
  <button type="button" class="btn btn-primary js-send-all">Send all my feedback</button>
  <p class="bundle-hint">Bundles every card you&rsquo;ve written on into one email.</p>
</section>
{notes}
{footer(day)}
<script src="{root}assets/app.js" defer></script>
</body>
</html>
'''


def archive_page(days):
    rows = []
    for day in days:
        jobs = day.get("jobs", [])
        companies = []
        for j in jobs:
            if j["company"] not in companies:
                companies.append(j["company"])
        rows.append(f'''<li><a href="days/{day["date"]}.html">
  <span class="ar-date">{esc(long_date(day["date"]))}</span>
  <span class="ar-title">{esc(day.get("title") or "Daily picks")} &middot; {len(jobs)} pick{"s" if len(jobs) != 1 else ""}</span>
  <span class="ar-co">{esc(", ".join(companies))}</span></a></li>''')
    return f'''{head("Archive · Kristen's job board", "")}
<body class="archive" data-inbox="{INBOX}">
<header class="hero">
  <div class="tricolore" aria-hidden="true"><span></span><span></span><span></span></div>
  <p class="eyebrow">The archive</p>
  <h1>Every day, <em>in one place</em></h1>
  <p class="sub"><a href="index.html">&larr; Back to the latest picks</a></p>
</header>
<main><ul class="archive-list">{"".join(rows)}</ul></main>
{footer()}
</body>
</html>
'''


def main():
    days = load_days()
    if not days:
        sys.exit("No data/*.json files found")
    DAYS.mkdir(exist_ok=True)
    for day in days:
        (DAYS / f"{day['date']}.html").write_text(day_page(day, days, "../"), encoding="utf-8")
    (ROOT / "index.html").write_text(day_page(days[0], days, ""), encoding="utf-8")
    (ROOT / "archive.html").write_text(archive_page(days), encoding="utf-8")
    # Drop pages whose data file was removed.
    keep = {f"{x['date']}.html" for x in days}
    for p in DAYS.glob("*.html"):
        if p.name not in keep:
            p.unlink()
    print(f"Built {len(days)} day(s); latest is {days[0]['date']}.")


if __name__ == "__main__":
    main()

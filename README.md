# Kristen's job board

A small static site that turns each weekday's job search for Kristen Weeder into a scrollable,
phone-friendly page. Hosted on GitHub Pages (public). No build tools, no dependencies: just
Python 3's standard library.

## Layout

```
data/YYYY-MM-DD.json   one file per day: the source of truth (edit these)
build.py               generator: data/*.json -> HTML
index.html             latest day (generated)
days/YYYY-MM-DD.html   one page per day (generated)
archive.html           every day, newest first (generated)
assets/style.css       design (Parisian, mobile first)
assets/app.js          on-page sending (thoughts / resume requests) + "Past days" drawer
assets/fonts.css       self-hosted Cormorant Garamond + Jost (SIL OFL, from Google Fonts)
assets/img/            company logos / og:images downloaded from each company's own site
assets/img/SOURCES.md  where each image came from
screenshots/           reference renders (mobile 430px and desktop)
.nojekyll              tells GitHub Pages to serve files as-is
```

Generated files are committed so GitHub Pages can serve them directly from `main`.

## Adding a day (the daily routine)

1. Write `data/<YYYY-MM-DD>.json` (format below). Use only facts from the posting; leave a field
   out when it's unknown.
2. If a new company appears, save its logo or og:image into `assets/img/` (from the company's own
   site, never hotlinked) and note the source in `assets/img/SOURCES.md`. With no image, use a
   `monogram` tile.
3. `python3 build.py`
4. `git add -A && git commit -m "Add <date>" && git push`

## Day file format

```json
{
  "date": "2026-10-10",               // must match the file name
  "checked": "2026-10-09",            // date the listings were verified (defaults to date); shown in footer
  "title": "Kristen's Top 10",        // optional heading
  "intro": "One short paragraph.",    // optional
  "notes": ["Extra line", "..."],     // optional "Also worth knowing" list
  "jobs": [
    {
      "number": 3,                    // required: the stable job number she replies with
      "rank": 1,                      // optional; if every job has one, cards sort by it
      "title": "...",                 // required
      "company": "...",               // required
      "url": "https://...",           // required: the posting
      "location": "El Segundo, CA",
      "work_arrangement": "Hybrid (3 days in office)",
      "salary": "$77k–$110k + bonus",
      "posted": "2026-10-07",         // ISO date; "posted_label" (default "Posted") and "posted_extra" optional
      "french_tie": "L'Oréal (Paris HQ).",
      "travel": "Not mentioned in the posting",   // Paris/international travel exactly as stated
      "why": "Why it fits you...",
      "stretch": false,
      "stretch_note": "Why it's a stretch",
      "from_earlier": true,           // shows a "From earlier" badge
      "status": "You're applying: ...",  // optional highlighted line
      "image": {"src": "assets/img/x.png", "kind": "logo", "bg": "#ffffff", "source": "https://..."}
      // or {"kind": "photo", "src": "...", "label": "WORDMARK"}
      // or {"kind": "monogram", "text": "CHANEL", "sub": "", "bg": "#000", "fg": "#fff", "spaced": true}
    }
  ]
}
```
(Comments above are for explanation only; real JSON files can't contain them.)

## How feedback works

Each card has two separate panels, each with its own button and its own confirmation:

- **Share my thoughts**: "What I liked" + "What I didn't like" and a **Send my thoughts** button.
- **Tailor my resume for this role**: an optional "Anything to emphasize?" note and a
  **Tailor my resume** button.

Sending happens right on the page: `assets/app.js` POSTs JSON with `fetch` to
**FormSubmit.co's AJAX endpoint** (`ENDPOINT` at the top of `assets/app.js`, the only place to
change the service). FormSubmit emails the submission to **kristenbot@mail.grokbot.com** and answers
with JSON. The card shows a green "Got it ✓ — Kristen Bot received this at <time>" only when that
JSON says `success: "true"`; otherwise it shows the error, a **Try again** button and a
"send it by email instead" `mailto:` fallback.

Each email has:

- Subject `Job board: THOUGHTS #<n> <title> at <company>` or
  `Job board: RESUME REQUEST #<n> <title> at <company>`
- Reply-To `Kweeder13@gmail.com` (set in `build.py` as `REPLY_TO`)
- Fields: Type, Job number, Title, Company, Posting, Page date, her text, Sent from (page URL)

Drafts and the time of each confirmed send are kept in the browser's `localStorage` (keyed by job
number, so they follow a job across days). On a later visit the panel shows "✓ Sent Oct 10" and
the button becomes **Send an update** / **Send another request**.

The email arrives in the Kristen Bot inbox, where the routine logs thoughts to `PREFERENCES.md`,
makes a tailored resume when one is requested, and continues the conversation by email with
Kristen.

FormSubmit needs a one-time activation: the first submission sends an "Activate Form" email to
kristenbot@mail.grokbot.com, and nothing is delivered until its link is clicked.

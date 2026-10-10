/* Kristen's job board: on-page sending with confirmed delivery + Past days drawer. No dependencies.
 *
 * Each card has two separate actions, each sent on its own:
 *   "Share my thoughts"            -> type "thoughts"
 *   "Tailor my resume for this role" -> type "resume request"
 * Submissions go to ENDPOINT (FormSubmit.co's AJAX API), which emails them to the Kristen Bot
 * inbox and answers with JSON. A card only shows "Got it" after that JSON says success.
 */
(function () {
  "use strict";

  /* ---------- config: the one place to change the delivery service ---------- */
  var ENDPOINT = "https://formsubmit.co/ajax/kristenbot@mail.grokbot.com";
  var TIMEOUT_MS = 20000;

  var INBOX = document.body.getAttribute("data-inbox") || "kristenbot@mail.grokbot.com";
  var REPLY_TO = document.body.getAttribute("data-replyto") || "Kweeder13@gmail.com";
  var PAGE_DATE = document.body.getAttribute("data-date") || "";
  var SUBJECT_PREFIX = window.__kjbSubjectPrefix || "";   // used only for test sends
  var KEY = "kjb:v1:job:";

  /* ---------- storage (keyed by job number, so notes follow a job across days) ---------- */
  function load(n) {
    try { return JSON.parse(localStorage.getItem(KEY + n)) || {}; } catch (e) { return {}; }
  }
  function patch(n, obj) {
    var s = load(n);
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) s[k] = obj[k];
    try { localStorage.setItem(KEY + n, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function fmtDay(ts) {
    return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function isToday(ts) { return new Date(ts).toDateString() === new Date().toDateString(); }

  var KINDS = {
    thoughts: {
      label: "THOUGHTS", type: "Thoughts",
      send: "Send my thoughts", again: "Send an update",
      stamp: "thoughtsSentAt", fields: ["liked", "disliked"],
      empty: "Write what you liked or didn\u2019t like first.",
      after: ""
    },
    resume: {
      label: "RESUME REQUEST", type: "Resume request",
      send: "Tailor my resume", again: "Send another request",
      stamp: "resumeSentAt", fields: ["note"],
      empty: "",
      after: "I\u2019ll email you back shortly with your tailored resume."
    }
  };

  function job(card) {
    return {
      number: card.getAttribute("data-number"),
      title: card.getAttribute("data-title"),
      company: card.getAttribute("data-company"),
      url: card.getAttribute("data-url")
    };
  }
  function val(card, f) {
    var el = card.querySelector('[data-field="' + f + '"]');
    return el ? el.value.trim() : "";
  }

  function subjectFor(kind, j) {
    return SUBJECT_PREFIX + "Job board: " + KINDS[kind].label + " #" + j.number + " " + j.title + " at " + j.company;
  }

  function payload(kind, card) {
    var j = job(card);
    var p = {
      _subject: subjectFor(kind, j),
      _replyto: REPLY_TO,
      _template: "table",
      _captcha: "false",
      "Type": KINDS[kind].type,
      "Job number": "#" + j.number,
      "Title": j.title,
      "Company": j.company,
      "Posting": j.url,
      "Page date": PAGE_DATE || "(unknown)"
    };
    if (kind === "thoughts") {
      p["What I liked"] = val(card, "liked") || "(nothing written)";
      p["What I didn't like"] = val(card, "disliked") || "(nothing written)";
    } else {
      p["Anything to emphasize"] = val(card, "note") || "(nothing written)";
    }
    p["Sent from"] = window.location.href.split("#")[0];
    return p;
  }

  function mailtoFor(kind, card) {
    var p = payload(kind, card), lines = [];
    for (var k in p) if (k.charAt(0) !== "_") lines.push(k + ": " + p[k]);
    return "mailto:" + INBOX + "?subject=" + encodeURIComponent(p._subject) +
      "&body=" + encodeURIComponent("Hi Kristen Bot,\r\n\r\n" + lines.join("\r\n"));
  }

  function post(data) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (r.ok && j && String(j.success) === "true") return j;
        var msg = (j && j.message) || ("The server answered " + r.status + ".");
        throw new Error(msg);
      });
    }, function (e) {
      throw new Error(e && e.name === "AbortError" ? "It took too long to hear back." : "Couldn\u2019t reach the server. Check your connection.");
    }).then(function (j) { if (timer) clearTimeout(timer); return j; },
            function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function setupPanel(card, panel) {
    var kind = panel.getAttribute("data-kind");
    var K = KINDS[kind];
    var n = card.getAttribute("data-number");
    var btn = panel.querySelector(".js-send");
    var lbl = btn.querySelector(".lbl");
    var box = panel.querySelector(".fb-status");
    var badge = panel.querySelector(".fb-badge");
    var saved = panel.querySelector(".saved");
    var flash;

    function idleLabel() { return load(n)[K.stamp] ? K.again : K.send; }

    function setBadge() {
      var ts = load(n)[K.stamp];
      if (ts) { badge.hidden = false; badge.textContent = "\u2713 Sent " + fmtDay(ts); }
      else badge.hidden = true;
    }

    function showConfirmed(ts, fresh) {
      box.hidden = false;
      box.className = "fb-status ok";
      box.textContent = "";
      var line = el("p", "fs-main");
      line.appendChild(el("span", "fs-check", "\u2713"));
      line.appendChild(document.createTextNode(fresh || isToday(ts)
        ? "Got it \u2713 \u2014 Kristen Bot received this at " + fmtTime(ts) + "."
        : "Sent " + fmtDay(ts) + " at " + fmtTime(ts) + ". Kristen Bot received it."));
      box.appendChild(line);
      if (K.after && fresh) box.appendChild(el("p", "fs-sub", K.after));
      if (!fresh) box.appendChild(el("p", "fs-sub", "Changed your mind? Edit and tap \u201c" + K.again + ".\u201d"));
      setBadge();
    }

    function showError(msg) {
      box.hidden = false;
      box.className = "fb-status err";
      box.textContent = "";
      box.appendChild(el("p", "fs-main", "That didn\u2019t go through. " + msg));
      var row = el("p", "fs-sub");
      var retry = el("button", "fs-retry", "Try again");
      retry.type = "button";
      retry.addEventListener("click", send);
      var mail = el("a", "", "send it by email instead");
      mail.href = mailtoFor(kind, card);
      row.appendChild(retry);
      row.appendChild(document.createTextNode(" or "));
      row.appendChild(mail);
      box.appendChild(row);
    }

    function setSending(on) {
      btn.disabled = on;
      panel.classList.toggle("is-sending", on);
      lbl.textContent = on ? "Sending\u2026" : idleLabel();
    }

    function send() {
      if (btn.disabled) return;
      if (K.empty && !K.fields.some(function (f) { return val(card, f); })) {
        box.hidden = false; box.className = "fb-status warn"; box.textContent = K.empty;
        return;
      }
      setSending(true);
      box.hidden = true;
      post(payload(kind, card)).then(function () {
        var ts = Date.now(), o = {}; o[K.stamp] = ts; patch(n, o);
        setSending(false);
        showConfirmed(ts, true);
      }, function (e) {
        setSending(false);
        showError(e.message);
      });
    }

    btn.addEventListener("click", send);

    // Restore drafts and any earlier confirmation.
    var state = load(n);
    K.fields.forEach(function (f) {
      var t = panel.querySelector('[data-field="' + f + '"]');
      if (!t) return;
      if (state[f]) t.value = state[f];
      t.addEventListener("input", function () {
        var o = {}; o[f] = t.value; var ok = patch(n, o);
        if (saved) {
          saved.textContent = ok ? "Saved on this device" : "";
          clearTimeout(flash); flash = setTimeout(function () { saved.textContent = ""; }, 1800);
        }
      });
    });
    lbl.textContent = idleLabel();
    setBadge();
    if (state[K.stamp]) showConfirmed(state[K.stamp], false);
    if (K.fields.some(function (f) { return state[f]; }) && !state[K.stamp]) panel.open = true;
  }

  Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
    Array.prototype.forEach.call(card.querySelectorAll(".fb[data-kind]"), function (panel) {
      setupPanel(card, panel);
    });
  });

  /* ---------- Past days drawer ---------- */
  var tab = document.querySelector(".pd-tab");
  var drawer = document.getElementById("pastdays");
  var scrim = document.querySelector(".pd-scrim");
  if (tab && drawer) {
    var setOpen = function (open) {
      tab.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { drawer.hidden = false; scrim.hidden = false;
        requestAnimationFrame(function () { document.body.classList.add("pd-open"); });
        var c = drawer.querySelector(".pd-close"); if (c) c.focus();
      } else {
        document.body.classList.remove("pd-open");
        setTimeout(function () { drawer.hidden = true; scrim.hidden = true; }, 250);
      }
    };
    tab.addEventListener("click", function () { setOpen(tab.getAttribute("aria-expanded") !== "true"); });
    drawer.querySelector(".pd-close").addEventListener("click", function () { setOpen(false); tab.focus(); });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawer.hidden) setOpen(false); });
  }
})();

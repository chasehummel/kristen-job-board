/* Kristen's job board: feedback by email + Past days drawer. No dependencies. */
(function () {
  "use strict";
  var INBOX = document.body.getAttribute("data-inbox") || "kristenbot@mail.grokbot.com";
  var PAGE_DATE = document.body.getAttribute("data-date") || "";
  var KEY = "kjb:v1:job:";

  /* ---------- storage (feedback is keyed by job number, so it follows a job across days) ---------- */
  function load(n) {
    try { return JSON.parse(localStorage.getItem(KEY + n)) || {}; } catch (e) { return {}; }
  }
  function save(n, obj) {
    try { localStorage.setItem(KEY + n, JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  function cardInfo(card) {
    var get = function (f) { return card.querySelector('[data-field="' + f + '"]'); };
    return {
      number: card.getAttribute("data-number"),
      title: card.getAttribute("data-title"),
      company: card.getAttribute("data-company"),
      url: card.getAttribute("data-url"),
      liked: get("liked").value.trim(),
      disliked: get("disliked").value.trim(),
      resume: get("resume").checked
    };
  }
  function hasContent(i) { return !!(i.liked || i.disliked || i.resume); }

  function block(i) {
    return [
      "Job #" + i.number + ": " + i.title,
      "Company: " + i.company,
      "Posting: " + i.url,
      "",
      "What I liked: " + (i.liked || "(nothing written)"),
      "What I didn't like: " + (i.disliked || "(nothing written)"),
      "Resume requested: " + (i.resume ? "yes" : "no")
    ].join("\r\n");
  }

  function openMail(subject, body) {
    var href = "mailto:" + INBOX + "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    if (typeof window.__kjbOpenMail === "function") { window.__kjbOpenMail(href); return; } // test hook
    window.location.href = href;
  }

  function footerLine() {
    return "\r\n\r\n(Sent from my job board" + (PAGE_DATE ? ", page for " + PAGE_DATE : "") + ")";
  }

  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));

  cards.forEach(function (card) {
    var n = card.getAttribute("data-number");
    var fields = card.querySelectorAll("[data-field]");
    var status = card.querySelector(".saved");
    var details = card.querySelector("details.fb");
    var state = load(n);
    var flash;

    Array.prototype.forEach.call(fields, function (el) {
      var f = el.getAttribute("data-field");
      if (f === "resume") el.checked = !!state.resume; else if (state[f]) el.value = state[f];
      el.addEventListener(f === "resume" ? "change" : "input", function () {
        var i = cardInfo(card);
        var ok = save(n, { liked: i.liked ? card.querySelector('[data-field="liked"]').value : "",
                           disliked: i.disliked ? card.querySelector('[data-field="disliked"]').value : "",
                           resume: i.resume, sentAt: (load(n).sentAt || null) });
        card.classList.toggle("has-feedback", hasContent(i));
        if (status) {
          status.textContent = ok ? "Saved on this device" : "";
          clearTimeout(flash); flash = setTimeout(function () { status.textContent = ""; }, 1800);
        }
      });
    });
    if (hasContent(cardInfo(card))) { card.classList.add("has-feedback"); if (details) details.open = true; }
    if (state.sentAt && status) status.textContent = "Last opened in email " + new Date(state.sentAt).toLocaleDateString();

    card.querySelector(".js-send-one").addEventListener("click", function () {
      var i = cardInfo(card);
      if (!hasContent(i)) {
        status.textContent = "Write a note or tick the resume box first";
        return;
      }
      var s = load(n); s.sentAt = Date.now(); save(n, s);
      status.textContent = "Opening your email app\u2026 just hit send";
      openMail("Job board feedback: #" + i.number + " " + i.title + " at " + i.company,
               "Hi Kristen Bot,\r\n\r\n" + block(i) + footerLine());
    });
  });

  var all = document.querySelector(".js-send-all");
  if (all) {
    var hint = document.querySelector(".bundle-hint");
    all.addEventListener("click", function () {
      var filled = cards.map(cardInfo).filter(hasContent);
      if (!filled.length) {
        hint.textContent = "Nothing to send yet. Open \u201cYour thoughts on this one\u201d on a card and jot a note.";
        return;
      }
      var wanted = filled.filter(function (i) { return i.resume; }).map(function (i) { return "#" + i.number; });
      var body = "Hi Kristen Bot,\r\n\r\nHere are my thoughts on " + filled.length + " job" +
        (filled.length > 1 ? "s" : "") + " from my job board" + (PAGE_DATE ? " (" + PAGE_DATE + ")" : "") + ".\r\n" +
        "Resumes requested: " + (wanted.length ? wanted.join(", ") : "none") + "\r\n\r\n" +
        filled.map(block).join("\r\n\r\n----------\r\n\r\n") + footerLine();
      filled.forEach(function (i) { var s = load(i.number); s.sentAt = Date.now(); save(i.number, s); });
      hint.textContent = "Opening your email app\u2026 just hit send.";
      openMail("Job board feedback: " + filled.length + " job" + (filled.length > 1 ? "s" : "") +
               (PAGE_DATE ? " from " + PAGE_DATE : ""), body);
    });
  }

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

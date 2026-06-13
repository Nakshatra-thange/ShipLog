/**
 * ShipLog Tracking Script v0.1
 * Paste into <head>: <script src="/shiplog.js" data-token="YOUR_TOKEN" async></script>
 * No dependencies. No frameworks. Works on any HTML page or SPA.
 */
(function () {
    "use strict";
  
    // ── Config ─────────────────────────────────────────────────────────────────
    var script = document.currentScript || (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();
  
    var TOKEN = script.getAttribute("data-token");
    var ENDPOINT = script.getAttribute("data-endpoint") || "http://localhost:3001/api/ingest";
    var FLUSH_INTERVAL = 5000; // ms — batch and send every 5 seconds
  
    if (!TOKEN) {
      console.warn("[ShipLog] No data-token found. Tracking disabled.");
      return;
    }
  
    // ── Session ID ─────────────────────────────────────────────────────────────
    // Persists across page navigations in the same browser tab session
    var SESSION_KEY = "sl_sid";
    var sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = "sl_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
  
    // ── Event queue ────────────────────────────────────────────────────────────
    var queue = [];
  
    function push(type, data) {
      queue.push({
        type: type,
        page: location.pathname,
        timestamp: new Date().toISOString(),
        data: data || {},
      });
    }
  
    // ── Flush — send batch via sendBeacon ──────────────────────────────────────
    function flush() {
      if (queue.length === 0) return;
      var payload = JSON.stringify({
        token: TOKEN,
        sessionId: sessionId,
        events: queue.splice(0), // drain queue atomically
        meta: {
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
          screenW: screen.width,
          screenH: screen.height,
          language: navigator.language,
        },
      });
  
      // sendBeacon: works even when tab closes, non-blocking
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
      } else {
        // Fallback for old browsers
        try {
          var xhr = new XMLHttpRequest();
          xhr.open("POST", ENDPOINT, false); // synchronous fallback only on unload
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.send(payload);
        } catch (e) {}
      }
    }
  
    // ── Click listener ─────────────────────────────────────────────────────────
    document.addEventListener(
      "click",
      function (e) {
        var target = e.target;
        if (!target) return;
  
        // Walk up to find meaningful element (button, a, [data-track])
        var el = target;
        for (var i = 0; i < 5 && el && el !== document.body; i++) {
          if (
            el.tagName === "BUTTON" ||
            el.tagName === "A" ||
            el.tagName === "INPUT" ||
            el.tagName === "SELECT" ||
            el.getAttribute("data-track") ||
            el.getAttribute("role") === "button"
          ) {
            break;
          }
          el = el.parentElement;
        }
        if (!el) el = target;
  
        push("click", {
          element: getSelector(el),
          text: (el.innerText || el.value || el.getAttribute("aria-label") || "").slice(0, 100),
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
          href: el.tagName === "A" ? el.getAttribute("href") : null,
        });
      },
      { passive: true }
    );
  
    // ── Error listener ─────────────────────────────────────────────────────────
    window.addEventListener("error", function (e) {
      push("error", {
        message: e.message || "Unknown error",
        stack: e.error && e.error.stack ? e.error.stack.slice(0, 500) : null,
        filename: e.filename || null,
        lineno: e.lineno || null,
        colno: e.colno || null,
      });
      // Flush errors immediately — don't wait for batch window
      flush();
    });
  
    window.addEventListener("unhandledrejection", function (e) {
      var msg = "Unhandled Promise rejection";
      try { msg = e.reason && e.reason.message ? e.reason.message : String(e.reason); } catch (_) {}
      push("error", { message: msg, stack: null });
      flush();
    });
  
    // ── Navigation — SPA support ───────────────────────────────────────────────
    // history.pushState doesn't fire popstate, so we patch it
    var lastPage = location.pathname;
  
    function onNavigate(newPage) {
      if (newPage === lastPage) return;
      push("navigate", { from: lastPage, to: newPage });
      lastPage = newPage;
    }
  
    // Patch pushState
    var _pushState = history.pushState.bind(history);
    history.pushState = function (state, title, url) {
      _pushState(state, title, url);
      if (url) onNavigate(new URL(url, location.href).pathname);
    };
  
    // Patch replaceState
    var _replaceState = history.replaceState.bind(history);
    history.replaceState = function (state, title, url) {
      _replaceState(state, title, url);
      if (url) onNavigate(new URL(url, location.href).pathname);
    };
  
    // Back/forward buttons
    window.addEventListener("popstate", function () {
      onNavigate(location.pathname);
    });
  
    // ── Scroll depth ───────────────────────────────────────────────────────────
    var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  
    function onScroll() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) return;
      var pct = Math.round((scrollTop / docH) * 100);
  
      [25, 50, 75, 100].forEach(function (milestone) {
        if (!scrollMilestones[milestone] && pct >= milestone) {
          scrollMilestones[milestone] = true;
          push("scroll", { depth: milestone, page: location.pathname });
        }
      });
    }
  
    // Reset milestones on navigation
    var _origOnNavigate = onNavigate;
    onNavigate = function (newPage) {
      _origOnNavigate(newPage);
      scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
    };
  
    window.addEventListener("scroll", onScroll, { passive: true });
  
    // ── Page visibility — flush when tab hides/closes ─────────────────────────
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
  
    // ── Periodic flush ─────────────────────────────────────────────────────────
    setInterval(flush, FLUSH_INTERVAL);
  
    // ── Record initial page view ───────────────────────────────────────────────
    push("navigate", { from: null, to: location.pathname });
  
    // ── Helpers ────────────────────────────────────────────────────────────────
    function getSelector(el) {
      if (!el || el === document.body) return "body";
      var parts = [];
      var cur = el;
      for (var i = 0; i < 4 && cur && cur !== document.body; i++) {
        var tag = cur.tagName.toLowerCase();
        var id = cur.id ? "#" + cur.id : "";
        var cls = cur.className && typeof cur.className === "string"
          ? "." + cur.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
        parts.unshift(tag + id + cls);
        if (id) break; // ID is unique enough, stop here
        cur = cur.parentElement;
      }
      return parts.join(" > ").slice(0, 120);
    }
  
    // Dev mode: log to console if ?sl_debug=1 in URL
    if (location.search.indexOf("sl_debug=1") !== -1) {
      console.log("[ShipLog] Tracking active. Token:", TOKEN, "Session:", sessionId);
    }
  })();
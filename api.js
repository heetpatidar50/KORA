/* KORA API client. With the Python server (python3 server.py) it calls /api over HTTP and keeps
   the session cookie. Without one (the hosted link, a static host) it runs the same API in the
   browser (local-api.js), so every page still works. The choice is made once per tab. */
window.KORA = (function () {
  "use strict";
  var MODE_KEY = "kora-api-mode";
  var mode = null;
  try { mode = sessionStorage.getItem(MODE_KEY); } catch (e) {}

  function detect() {
    if (mode) return Promise.resolve(mode);
    if (!/^https?:$/.test(location.protocol) || !window.fetch) return Promise.resolve(remember("local"));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2500);
    return fetch("/api/me", { credentials: "same-origin", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        var json = (res.headers.get("Content-Type") || "").indexOf("application/json") >= 0;
        if (!res.ok || !json) throw new Error("no server");
        return res.json();
      })
      .then(function (data) { return remember(data && "user" in data ? "server" : "local"); })
      .catch(function () { return remember("local"); })
      .then(function (m) { clearTimeout(timer); return m; });
  }
  function remember(m) { mode = m; try { sessionStorage.setItem(MODE_KEY, m); } catch (e) {} return m; }

  async function call(path, opts) {
    opts = opts || {};
    var method = opts.method || "GET";
    if ((await detect()) === "local") {
      var out = window.KORA_LOCAL.dispatch(method, path, opts.body ? JSON.parse(JSON.stringify(opts.body)) : {});
      if (out[0] >= 400) throw new Error(out[1].error || "Request failed (" + out[0] + ")");
      return out[1];
    }
    var res = await fetch("/api" + path, {
      method: method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || ("Request failed (" + res.status + ")"));
    return data;
  }
  return {
    get: function (p) { return call(p); },
    post: function (p, body) { return call(p, { method: "POST", body: body }); },
    del: function (p, body) { return call(p, { method: "DELETE", body: body }); },
    mode: detect,
    esc: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
  };
})();

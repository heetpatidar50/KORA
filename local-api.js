/* KORA's API, run in the browser when there is no Python server (the hosted link).
   The same routes, rules and messages as app/api.py; the data lives in this
   browser (localStorage, else memory), so each device keeps its own accounts,
   listings, bids and requests. */
window.KORA_LOCAL = (function () {
  "use strict";
  var KEY = "kora-local-db-v1";
  var ROLES = ["farmer", "buyer", "supplier"];
  var KINDS = ["transport", "quality", "machinery", "warehouse"];
  var OTP_TTL = 300, SESSION_TTL = 7 * 24 * 3600;
  var mem = null;

  function now() { return Date.now() / 1000; }
  function blank() {
    return { seq: 1, users: [], otps: [], sessions: [], listings: [], bids: [], service_requests: [] };
  }
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { mem = null; }
    if (!mem || !mem.users) mem = blank();
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* memory only */ } }
  function id(d) { return d.seq++; }
  function err(status, message) { return [status, { error: message }]; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function clean(s, limit) { return s == null ? null : (String(s).trim().slice(0, limit || 400) || null); }
  function digits(p) { return String(p || "").replace(/\D/g, ""); }
  function validPhone(p) { var n = digits(p).length; return n >= 10 && n <= 15; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function pub(u) { return { id: u.id, name: u.name, role: u.role, phone: u.phone, gst: u.gst || null }; }
  function userById(d, uid) { for (var i = 0; i < d.users.length; i++) if (d.users[i].id === uid) return d.users[i]; return null; }
  function find(list, key, v) { for (var i = 0; i < list.length; i++) if (list[i][key] === v) return list[i]; return null; }

  var TOKEN = "kora-local-session";
  function token() { try { return localStorage.getItem(TOKEN); } catch (e) { return mem && mem._token; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch (e) { if (mem) mem._token = t; } }
  function currentUser(d) {
    var t = token(); if (!t) return null;
    var s = find(d.sessions, "token", t);
    if (!s || s.expires_at < now()) return null;
    return userById(d, s.user_id);
  }
  function randomToken() {
    var a = new Uint8Array(24);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  /* ---- routes ---- */
  function requestOtp(d, b) {
    if (b.role != null && ROLES.indexOf(b.role) < 0) return err(400, "Invalid role.");
    if (!validPhone(b.phone)) return err(400, "Enter a valid phone number (10–15 digits).");
    var code = String(Math.floor(100000 + Math.random() * 900000));
    d.otps = d.otps.filter(function (o) { return o.phone !== digits(b.phone); });
    d.otps.push({ phone: digits(b.phone), code: code, role: b.role || null, expires_at: now() + OTP_TTL, used: false });
    return [200, { ok: true, pilot_otp: code, message: "OTP generated (pilot mode — shown on screen; no SMS sent)." }];
  }
  function verifyOtp(d, b) {
    var phone = digits(b.phone);
    if (!validPhone(phone)) return err(400, "Enter a valid phone number.");
    var o = null;
    for (var i = d.otps.length - 1; i >= 0; i--) if (d.otps[i].phone === phone && !d.otps[i].used) { o = d.otps[i]; break; }
    if (!o || o.code !== String(b.code || "").trim() || o.expires_at < now()) return err(401, "Incorrect or expired OTP.");
    var existing = find(d.users, "phone", phone), user = existing;
    if (!existing) {
      var role = b.role || o.role;
      if (ROLES.indexOf(role) < 0) return err(400, "Choose a role to register (farmer, buyer or supplier).");
      var name = clean(b.name, 120);
      if (!name) return err(400, "Name is required to register.");
      if (!b.consent) return err(400, "Please accept the Terms and Privacy Policy to continue.");
      user = { id: id(d), phone: phone, role: role, name: name,
               gst: (role === "buyer" || role === "supplier") ? clean(b.gst, 20) : null, created_at: now() };
      d.users.push(user);
    }
    o.used = true;
    var t = randomToken();
    d.sessions.push({ token: t, user_id: user.id, expires_at: now() + SESSION_TTL });
    setToken(t);
    return [200, { user: pub(user), new_account: !existing }];
  }
  function logout(d) {
    var t = token();
    d.sessions = d.sessions.filter(function (s) { return s.token !== t; });
    setToken(null);
    return [200, { ok: true }];
  }
  function deleteAccount(d, u) {
    if (!u) return err(401, "Not signed in.");
    var mine = d.listings.filter(function (l) { return l.farmer_id === u.id; }).map(function (l) { return l.id; });
    d.bids = d.bids.filter(function (b) { return b.buyer_id !== u.id && mine.indexOf(b.listing_id) < 0; });
    d.listings = d.listings.filter(function (l) { return l.farmer_id !== u.id; });
    d.service_requests = d.service_requests.filter(function (s) { return s.user_id !== u.id; });
    d.service_requests.forEach(function (s) { if (s.responder_id === u.id) { s.responder_id = null; s.status = "open"; } });
    d.sessions = d.sessions.filter(function (s) { return s.user_id !== u.id; });
    d.users = d.users.filter(function (x) { return x.id !== u.id; });
    setToken(null);
    return [200, { ok: true, message: "Account and related data deleted." }];
  }
  function bidCount(d, lid) { return d.bids.filter(function (b) { return b.listing_id === lid; }).length; }
  function byNewest(a, b) { return b.created_at - a.created_at; }
  function listListings(d, u) {
    if (!u) return err(401, "Sign in to view listings.");
    var rows = d.listings.filter(function (l) { return l.status === "active"; }).sort(byNewest).map(function (l) {
      var r = copy(l), f = userById(d, l.farmer_id);
      r.farmer_name = f ? f.name : ""; r.bid_count = bidCount(d, l.id); return r;
    });
    return [200, { listings: rows }];
  }
  function createListing(d, u, b) {
    if (!u) return err(401, "Sign in first.");
    if (u.role !== "farmer") return err(403, "Only farmers can create produce listings.");
    var crop = clean(b.crop, 80), qty = num(b.quantity_kg), price = num(b.price_per_kg);
    if (!crop) return err(400, "Crop is required.");
    if (!qty || qty <= 0) return err(400, "Quantity (kg) must be greater than 0.");
    if (price == null || price < 0) return err(400, "Enter a valid indicative price per kg.");
    var l = { id: id(d), farmer_id: u.id, crop: crop, variety: clean(b.variety, 80), quantity_kg: qty,
              grade: clean(b.grade, 40), price_per_kg: price, location: clean(b.location, 120),
              harvest_date: clean(b.harvest_date, 40), status: "active", created_at: now() };
    d.listings.push(l);
    return [201, { listing: copy(l) }];
  }
  function myListings(d, u) {
    if (!u || u.role !== "farmer") return err(403, "Farmers only.");
    var out = d.listings.filter(function (l) { return l.farmer_id === u.id; }).sort(byNewest).map(function (l) {
      var r = copy(l);
      r.bids = d.bids.filter(function (b) { return b.listing_id === l.id; })
        .sort(function (a, b) { return (b.price_per_kg - a.price_per_kg) || (a.created_at - b.created_at); })
        .map(function (b) { var x = copy(b), by = userById(d, b.buyer_id); x.buyer_name = by ? by.name : ""; return x; });
      return r;
    });
    return [200, { listings: out }];
  }
  function closeListing(d, u, lid) {
    if (!u || u.role !== "farmer") return err(403, "Farmers only.");
    var l = find(d.listings, "id", lid);
    if (!l || l.farmer_id !== u.id) return err(404, "Listing not found.");
    l.status = "closed"; return [200, { ok: true }];
  }
  function createBid(d, u, lid, b) {
    if (!u) return err(401, "Sign in first.");
    if (u.role !== "buyer") return err(403, "Only buyers can place bids.");
    var price = num(b.price_per_kg), qty = num(b.quantity_kg);
    if (price == null || price <= 0) return err(400, "Enter a valid bid price per kg.");
    var l = find(d.listings, "id", lid);
    if (!l || l.status !== "active") return err(404, "Listing not available.");
    if (!qty || qty <= 0) qty = l.quantity_kg;
    var bid = { id: id(d), listing_id: lid, buyer_id: u.id, price_per_kg: price, quantity_kg: qty,
                message: clean(b.message, 240), status: "pending", created_at: now() };
    d.bids.push(bid);
    return [201, { bid: copy(bid) }];
  }
  function myBids(d, u) {
    if (!u || u.role !== "buyer") return err(403, "Buyers only.");
    var rows = d.bids.filter(function (b) { return b.buyer_id === u.id; }).sort(byNewest).map(function (b) {
      var x = copy(b), l = find(d.listings, "id", b.listing_id) || {}, f = userById(d, l.farmer_id);
      x.crop = l.crop; x.variety = l.variety; x.grade = l.grade; x.farmer_name = f ? f.name : ""; return x;
    });
    return [200, { bids: rows }];
  }
  function decideBid(d, u, bidId, decision) {
    if (!u || u.role !== "farmer") return err(403, "Farmers only.");
    var b = find(d.bids, "id", bidId), l = b && find(d.listings, "id", b.listing_id);
    if (!b || !l || l.farmer_id !== u.id) return err(404, "Bid not found.");
    b.status = decision;
    if (decision === "accepted") {
      l.status = "closed";
      d.bids.forEach(function (o) { if (o.listing_id === l.id && o.id !== b.id && o.status === "pending") o.status = "rejected"; });
    }
    return [200, { ok: true }];
  }
  function listRequests(d, u) {
    if (!u) return err(401, "Sign in first.");
    var rows = d.service_requests.filter(function (s) {
      return u.role === "supplier" ? (s.status === "open" || s.status === "responding") : s.user_id === u.id;
    }).sort(byNewest).map(function (s) { var x = copy(s), r = userById(d, s.user_id); x.requester_name = r ? r.name : ""; return x; });
    return [200, { requests: rows }];
  }
  function createRequest(d, u, b) {
    if (!u) return err(401, "Sign in first.");
    if (u.role === "supplier") return err(403, "Suppliers respond to requests rather than create them.");
    if (KINDS.indexOf(b.kind) < 0) return err(400, "Choose transport, quality, machinery or warehouse.");
    var title = clean(b.title, 120);
    if (!title) return err(400, "A short title is required.");
    var s = { id: id(d), user_id: u.id, kind: b.kind, title: title, details: clean(b.details, 400),
              status: "open", responder_id: null, created_at: now() };
    d.service_requests.push(s);
    return [201, { request: copy(s) }];
  }
  function respondRequest(d, u, rid) {
    if (!u || u.role !== "supplier") return err(403, "Suppliers only.");
    var s = find(d.service_requests, "id", rid);
    if (!s) return err(404, "Request not found.");
    s.status = "responding"; s.responder_id = u.id; return [200, { ok: true }];
  }
  function stats(d, u) {
    if (!u) return err(401, "Sign in first.");
    var count = function (list, f) { return list.filter(f).length; };
    var s = {
      active_listings: count(d.listings, function (l) { return l.status === "active"; }),
      total_bids: d.bids.length,
      open_requests: count(d.service_requests, function (r) { return r.status === "open"; }),
    };
    if (u.role === "farmer") {
      var mine = d.listings.filter(function (l) { return l.farmer_id === u.id; }).map(function (l) { return l.id; });
      s.my_listings = mine.length;
      s.bids_received = count(d.bids, function (b) { return mine.indexOf(b.listing_id) >= 0; });
    } else if (u.role === "buyer") {
      s.my_bids = count(d.bids, function (b) { return b.buyer_id === u.id; });
      s.accepted = count(d.bids, function (b) { return b.buyer_id === u.id && b.status === "accepted"; });
    } else {
      s.requests_responding = count(d.service_requests, function (r) { return r.responder_id === u.id; });
    }
    return [200, { stats: s }];
  }

  function dispatch(method, path, body) {
    var d = load(), parts = path.split("?")[0].split("/").filter(Boolean), n = parts.length, head = parts[0] || "";
    var u = currentUser(d), b = body || {}, int = function (x) { return parseInt(x, 10); }, r = null;
    if (head === "auth") {
      if (method === "POST" && parts[1] === "request-otp") r = requestOtp(d, b);
      else if (method === "POST" && parts[1] === "verify-otp") r = verifyOtp(d, b);
      else if (method === "POST" && parts[1] === "logout") r = logout(d);
    } else if (head === "me" && method === "GET") r = [200, { user: u ? pub(u) : null }];
    else if (head === "account" && method === "DELETE") r = deleteAccount(d, u);
    else if (head === "stats" && method === "GET") r = stats(d, u);
    else if (head === "listings") {
      if (n === 1 && method === "GET") r = listListings(d, u);
      else if (n === 1 && method === "POST") r = createListing(d, u, b);
      else if (n === 2 && parts[1] === "mine" && method === "GET") r = myListings(d, u);
      else if (n === 2 && method === "DELETE") r = closeListing(d, u, int(parts[1]));
      else if (n === 3 && parts[2] === "bids" && method === "POST") r = createBid(d, u, int(parts[1]), b);
    } else if (head === "bids") {
      if (n === 2 && parts[1] === "mine" && method === "GET") r = myBids(d, u);
      else if (n === 3 && method === "POST" && (parts[2] === "accept" || parts[2] === "reject"))
        r = decideBid(d, u, int(parts[1]), parts[2] === "accept" ? "accepted" : "rejected");
    } else if (head === "service-requests") {
      if (n === 1 && method === "GET") r = listRequests(d, u);
      else if (n === 1 && method === "POST") r = createRequest(d, u, b);
      else if (n === 3 && parts[2] === "respond" && method === "POST") r = respondRequest(d, u, int(parts[1]));
    }
    if (!r) r = err(404, "Not found.");
    if (method !== "GET") save();
    return r;
  }
  return { dispatch: dispatch };
})();

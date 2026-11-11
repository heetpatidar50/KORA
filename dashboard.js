/* Role-based workspace for KORA. Fetches the signed-in user and renders the
   relevant panels: farmer (listings + bids + service requests), buyer
   (browse + bids + service requests), supplier (respond to requests).
   UI text is written in English inside its own element; i18n.js translates
   it as it is added, so the dashboard follows the chosen language. */
(function () {
  "use strict";
  var api = window.KORA, esc = api.esc;
  var me;

  var root = document.getElementById("dash");
  if (!root) return;

  /* messages appear in the page (a hosted page cannot open alert boxes) */
  function notify(text) {
    var box = document.getElementById("toast");
    if (!box) {
      box = document.createElement("div"); box.id = "toast"; box.className = "toast";
      box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    box.textContent = text; box.classList.add("is-on");
    clearTimeout(notify.t); notify.t = setTimeout(function () { box.classList.remove("is-on"); }, 4000);
  }
  function T(s) { return window.KORAI18N ? window.KORAI18N.t(s) : s; }
  function L(s) { return "<span>" + esc(s) + "</span>"; }            // translatable label
  function money(n) { return "₹" + Number(n).toFixed(2); }
  function kg(n) { return Number(n).toLocaleString("en-IN") + " kg"; }
  function pill(status) { return '<span class="pill pill--' + esc(status) + '">' + esc(status) + "</span>"; }
  var ROLE = { farmer: "Farmer", buyer: "Buyer", supplier: "Supplier" };
  var KIND = { transport: "Transport", quality: "Quality testing", machinery: "Machinery", warehouse: "Warehouses" };

  async function boot() {
    try { me = (await api.get("/me")).user; } catch (e) { me = null; }
    if (!me) { location.href = "login.html"; return; }
    renderHeader();
    if ((await api.mode()) === "local") {
      var note = document.createElement("p");
      note.className = "local-note";
      note.innerHTML = "<span>" + esc("Demo mode: your account and data are saved in this browser on this device.") + "</span>";
      document.getElementById("dashSub").after(note);
    }
    await renderStats();
    if (me.role === "farmer") renderFarmer();
    else if (me.role === "buyer") renderBuyer();
    else renderSupplier();
  }

  function renderHeader() {
    document.getElementById("whoName").textContent = me.name;
    document.getElementById("whoRole").textContent = ROLE[me.role];
    document.getElementById("dashHello").innerHTML = L("Welcome") + ", " + esc(me.name.split(" ")[0]) + ".";
    var subs = {
      farmer: "List your produce, review bids, and accept the best offer.",
      buyer: "Browse farmer listings, place transparent bids, and track them.",
      supplier: "Respond to open service requests from farmers and buyers.",
    };
    document.getElementById("dashSub").textContent = subs[me.role];
    document.getElementById("logout").addEventListener("click", async function (e) {
      e.preventDefault();
      try { await api.post("/auth/logout", {}); } catch (x) {}
      location.href = "index.html";
    });
  }

  async function renderStats() {
    var wrap = document.getElementById("stats");
    try {
      var s = (await api.get("/stats")).stats, tiles;
      if (me.role === "farmer") {
        tiles = [["My listings", s.my_listings], ["Bids received", s.bids_received],
                 ["Active market", s.active_listings], ["Open requests", s.open_requests]];
      } else if (me.role === "buyer") {
        tiles = [["My bids", s.my_bids], ["Accepted", s.accepted],
                 ["Active listings", s.active_listings], ["Total bids", s.total_bids]];
      } else {
        tiles = [["Open requests", s.open_requests], ["I'm responding to", s.requests_responding],
                 ["Active listings", s.active_listings], ["Total bids", s.total_bids]];
      }
      wrap.innerHTML = tiles.map(function (t) {
        return '<div class="stat-tile glass"><div class="n">' + (t[1] || 0) +
               '</div><div class="l">' + esc(t[0]) + "</div></div>";
      }).join("");
    } catch (e) { wrap.innerHTML = ""; }
  }

  /* ---------------- FARMER ---------------- */
  function renderFarmer() {
    var host = document.getElementById("panels");
    host.innerHTML =
      '<section class="panel glass">' +
        "<h2>" + L("List produce") + "</h2>" +
        '<p class="phint">' + L("Add a crop with quantity and an indicative price. Buyers bid after sign-in.") + "</p>" +
        '<div class="row2">' + field("f_crop", "Crop", "e.g. Tomato") + field("f_variety", "Variety (optional)", "e.g. Roma") + "</div>" +
        '<div class="row2">' + field("f_qty", "Quantity (kg)", "500", "number") + field("f_price", "Indicative ₹/kg", "14", "number") + "</div>" +
        '<div class="row2">' + field("f_grade", "Grade (optional)", "A") + field("f_loc", "Location (optional)", "Nashik") + "</div>" +
        '<button class="btn btn--gold" id="addListing">' + L("Publish listing") + "</button>" +
      "</section>" +
      '<section class="panel glass"><h2>' + L("My listings") + "</h2>" +
        '<p class="phint">' + L("Review bids and accept the best. Accepting closes the listing.") + "</p>" +
        '<div class="cardlist" id="myListings"><div class="empty">' + L("Loading…") + "</div></div>" +
      "</section>" + servicePanels();

    document.getElementById("addListing").addEventListener("click", async function () {
      var body = {
        crop: val("f_crop"), variety: val("f_variety"), quantity_kg: val("f_qty"),
        price_per_kg: val("f_price"), grade: val("f_grade"), location: val("f_loc"),
      };
      if (!body.crop || !body.quantity_kg || !body.price_per_kg) { notify(T("Crop, quantity and price are required.")); return; }
      try {
        await api.post("/listings", body);
        ["f_crop", "f_variety", "f_qty", "f_price", "f_grade", "f_loc"].forEach(function (i) { document.getElementById(i).value = ""; });
        loadMyListings(); renderStats();
      } catch (e) { notify(T(e.message)); }
    });
    loadMyListings();
    wireServicePanels();
  }

  async function loadMyListings() {
    var box = document.getElementById("myListings");
    var data = (await api.get("/listings/mine")).listings;
    if (!data.length) { box.innerHTML = '<div class="empty">' + L("No listings yet — publish your first above.") + "</div>"; return; }
    box.innerHTML = data.map(function (l) {
      var bids = (l.bids || []).map(function (b) {
        var acts = b.status === "pending"
          ? '<div class="acts"><button class="btn btn--xs btn--gold" data-accept="' + b.id + '">' + L("Accept") + "</button>" +
            '<button class="btn btn--xs btn--line" data-reject="' + b.id + '">' + L("Reject") + "</button></div>"
          : pill(b.status);
        return '<div class="bidrow"><span><span class="who">' + esc(b.buyer_name) + "</span> · " +
               money(b.price_per_kg) + "/kg · " + kg(b.quantity_kg) + "</span>" + acts + "</div>";
      }).join("") || '<div class="empty">' + L("No bids yet.") + "</div>";
      return '<div class="litem"><div class="top"><span class="crop">' + esc(l.crop) +
        (l.variety ? " · " + esc(l.variety) : "") + '</span><span class="price">' + money(l.price_per_kg) +
        "/kg</span></div><div class='meta'>" + kg(l.quantity_kg) +
        (l.grade ? " · " + L("Grade") + " " + esc(l.grade) : "") +
        (l.location ? " · " + esc(l.location) : "") + " · " + pill(l.status) +
        "</div><div class='sub'>" + bids + "</div></div>";
    }).join("");
    box.querySelectorAll("[data-accept]").forEach(function (b) {
      b.addEventListener("click", function () { decide(b.dataset.accept, "accept"); });
    });
    box.querySelectorAll("[data-reject]").forEach(function (b) {
      b.addEventListener("click", function () { decide(b.dataset.reject, "reject"); });
    });
  }
  async function decide(bidId, what) {
    try { await api.post("/bids/" + bidId + "/" + what, {}); loadMyListings(); renderStats(); }
    catch (e) { notify(T(e.message)); }
  }

  /* ---------------- BUYER ---------------- */
  function renderBuyer() {
    var host = document.getElementById("panels");
    host.innerHTML =
      '<div class="tabs"><button class="tab is-active" data-tab="browse">' + L("Browse listings") + "</button>" +
        '<button class="tab" data-tab="mine">' + L("My bids") + "</button></div>" +
      '<section class="panel glass" id="tab-browse"><h2>' + L("Produce listings") + "</h2>" +
        '<p class="phint">' + L("Place a transparent bid — the farmer can accept, reject or counter.") + "</p>" +
        '<div class="cardlist" id="browseList"><div class="empty">' + L("Loading…") + "</div></div></section>" +
      '<section class="panel glass hidden" id="tab-mine"><h2>' + L("My bids") + "</h2>" +
        '<div class="cardlist" id="myBids"><div class="empty">' + L("Loading…") + "</div></div></section>" +
      servicePanels();
    host.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        host.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("is-active"); });
        t.classList.add("is-active");
        document.getElementById("tab-browse").classList.toggle("hidden", t.dataset.tab !== "browse");
        document.getElementById("tab-mine").classList.toggle("hidden", t.dataset.tab !== "mine");
        if (t.dataset.tab === "mine") loadMyBids();
      });
    });
    loadBrowse();
    wireServicePanels();
  }
  async function loadBrowse() {
    var box = document.getElementById("browseList");
    var data = (await api.get("/listings")).listings;
    if (!data.length) { box.innerHTML = '<div class="empty">' + L("No active listings right now.") + "</div>"; return; }
    box.innerHTML = data.map(function (l) {
      return '<div class="litem"><div class="top"><span class="crop">' + esc(l.crop) +
        (l.variety ? " · " + esc(l.variety) : "") + '</span><span class="price">' + money(l.price_per_kg) +
        "/kg</span></div><div class='meta'>" + esc(l.farmer_name) + " · " + kg(l.quantity_kg) +
        (l.grade ? " · " + L("Grade") + " " + esc(l.grade) : "") + (l.location ? " · " + esc(l.location) : "") +
        " · " + L("Bids") + ": " + (l.bid_count || 0) + "</div>" +
        "<div class='inline-form'>" +
          "<div class='field'><label for='bp_" + l.id + "'>" + L("Your ₹/kg") + "</label><input class='input' type='number' inputmode='decimal' min='0' step='any' id='bp_" + l.id + "'></div>" +
          "<div class='field'><label for='bq_" + l.id + "'>" + L("Quantity (kg)") + "</label><input class='input' type='number' inputmode='decimal' min='0' step='any' id='bq_" + l.id + "' placeholder='" + l.quantity_kg + "'></div>" +
          "<button class='btn btn--gold' data-bid='" + l.id + "'>" + L("Place bid") + "</button>" +
        "</div></div>";
    }).join("");
    box.querySelectorAll("[data-bid]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.dataset.bid;
        var price = document.getElementById("bp_" + id).value;
        var qty = document.getElementById("bq_" + id).value;
        if (!price) { notify(T("Enter your bid price.")); return; }
        try {
          await api.post("/listings/" + id + "/bids", { price_per_kg: price, quantity_kg: qty });
          btn.innerHTML = L("Bid placed ✓"); btn.disabled = true; renderStats();
        } catch (e) { notify(T(e.message)); }
      });
    });
  }
  async function loadMyBids() {
    var box = document.getElementById("myBids");
    var data = (await api.get("/bids/mine")).bids;
    if (!data.length) { box.innerHTML = '<div class="empty">' + L("You haven't placed any bids yet.") + "</div>"; return; }
    box.innerHTML = data.map(function (b) {
      return '<div class="litem"><div class="top"><span class="crop">' + esc(b.crop) +
        (b.variety ? " · " + esc(b.variety) : "") + "</span>" + pill(b.status) + "</div>" +
        "<div class='meta'>" + esc(b.farmer_name) + " · " + L("Your bid") + ": " + money(b.price_per_kg) + "/kg · " + kg(b.quantity_kg) + "</div></div>";
    }).join("");
  }

  /* ---------------- SERVICE REQUESTS (farmer + buyer) ---------------- */
  function servicePanels() {
    return '<section class="panel glass"><h2>' + L("Request a service") + "</h2>" +
        '<p class="phint">' + L("Need transport, quality testing, machinery or storage? Registered suppliers will respond.") + "</p>" +
        '<div class="row2"><div class="field"><label for="sr_kind">' + L("Service type") + "</label>" +
          '<select class="input" id="sr_kind">' +
            '<option value="transport">Transport</option><option value="quality">Quality testing</option>' +
            '<option value="machinery">Machinery</option><option value="warehouse">Warehouses</option>' +
          "</select></div>" + field("sr_title", "Title", "") + "</div>" +
        '<div class="field"><label for="sr_details">' + L("Details (optional)") + '</label><textarea class="input" id="sr_details" name="sr_details"></textarea></div>' +
        '<button class="btn btn--gold" id="sr_submit">' + L("Submit request") + "</button>" +
      "</section>" +
      '<section class="panel glass"><h2>' + L("My service requests") + "</h2>" +
        '<div class="cardlist" id="myRequests"><div class="empty">' + L("Loading…") + "</div></div>" +
      "</section>";
  }
  function wireServicePanels() {
    document.getElementById("sr_submit").addEventListener("click", async function () {
      var btn = this;
      try {
        await api.post("/service-requests", {
          kind: document.getElementById("sr_kind").value,
          title: val("sr_title"), details: val("sr_details"),
        });
        document.getElementById("sr_title").value = ""; document.getElementById("sr_details").value = "";
        btn.innerHTML = L("Request sent ✓");
        setTimeout(function () { btn.innerHTML = L("Submit request"); }, 1800);
        loadMyRequests(); renderStats();
      } catch (e) { notify(T(e.message)); }
    });
    loadMyRequests();
  }
  async function loadMyRequests() {
    var box = document.getElementById("myRequests");
    var data = (await api.get("/service-requests")).requests;
    if (!data.length) { box.innerHTML = '<div class="empty">' + L("No requests yet.") + "</div>"; return; }
    box.innerHTML = data.map(function (r) {
      return '<div class="litem"><div class="top"><span class="crop">' + esc(r.title) + "</span>" + pill(r.status) +
        "</div><div class='meta'>" + L(KIND[r.kind] || r.kind) + (r.details ? " · " + esc(r.details) : "") + "</div></div>";
    }).join("");
  }

  /* ---------------- SUPPLIER ---------------- */
  function renderSupplier() {
    var host = document.getElementById("panels");
    host.innerHTML =
      '<section class="panel glass"><h2>' + L("Open service requests") + "</h2>" +
        '<p class="phint">' + L("Transport, quality testing, machinery and warehousing requests from farmers and buyers.") + "</p>" +
        '<div class="cardlist" id="reqList"><div class="empty">' + L("Loading…") + "</div></div></section>";
    loadRequests();
  }
  async function loadRequests() {
    var box = document.getElementById("reqList");
    var data = (await api.get("/service-requests")).requests;
    if (!data.length) { box.innerHTML = '<div class="empty">' + L("No open requests right now.") + "</div>"; return; }
    box.innerHTML = data.map(function (r) {
      var act = r.status === "open"
        ? "<button class='btn btn--xs btn--gold' data-respond='" + r.id + "'>" + L("Respond") + "</button>"
        : pill(r.status);
      return '<div class="litem"><div class="top"><span class="crop">' + esc(r.title) +
        "</span><span>" + act + "</span></div><div class='meta'>" + L(KIND[r.kind] || r.kind) + " · " +
        esc(r.requester_name) + (r.details ? " · " + esc(r.details) : "") + "</div></div>";
    }).join("");
    box.querySelectorAll("[data-respond]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        try { await api.post("/service-requests/" + btn.dataset.respond + "/respond", {}); loadRequests(); renderStats(); }
        catch (e) { notify(T(e.message)); }
      });
    });
  }

  /* ---------------- helpers ---------------- */
  function field(id, label, ph, type) {
    var num = type === "number";
    return "<div class='field'><label for='" + id + "'>" + L(label) + "</label><input class='input' id='" + id + "' name='" + id +
      "' type='" + (type || "text") + "'" + (num ? " inputmode='decimal' min='0' step='any'" : " autocomplete='off'") +
      " placeholder='" + esc(ph) + "'></div>";
  }
  function val(id) { return document.getElementById(id).value.trim(); }

  boot();
})();

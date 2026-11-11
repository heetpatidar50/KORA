/* Drives login.html and register.html: request OTP, then verify. */
(function () {
  "use strict";
  var api = window.KORA;
  var root = document.querySelector("[data-auth]");
  if (!root) return;
  var mode = root.getAttribute("data-auth"); // "login" | "register"

  var msg = root.querySelector("#msg");
  var stepPhone = root.querySelector("#step-phone");
  var stepOtp = root.querySelector("#step-otp");
  var phoneInput = root.querySelector("#phone");
  var otpInput = root.querySelector("#otp");
  var otpHint = root.querySelector("#otpHint");
  var otpCode = root.querySelector("#otpCode");
  var sendBtn = root.querySelector("#sendBtn");
  var verifyBtn = root.querySelector("#verifyBtn");

  var chosenRole = null;
  var chips = root.querySelectorAll(".rolechip");

  // preselect role from ?role= on register
  var params = new URLSearchParams(location.search);
  var preRole = params.get("role") || location.hash.replace("#", "");
  chips.forEach(function (chip) {
    if (chip.dataset.role === preRole) setRole(chip);
    chip.addEventListener("click", function () { setRole(chip); });
    chip.addEventListener("keydown", function (e) {
      var i = Array.prototype.indexOf.call(chips, chip), n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") n = chips[(i + 1) % chips.length];
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = chips[(i + chips.length - 1) % chips.length];
      if (n) { e.preventDefault(); n.focus(); setRole(n); }
    });
  });
  function setRole(chip) {
    chosenRole = chip.dataset.role;
    chips.forEach(function (c) {
      c.classList.toggle("is-active", c === chip);
      c.setAttribute("aria-checked", c === chip ? "true" : "false");
    });
  }

  function show(type, text) {
    if (!msg) return;
    msg.className = "msg " + type;
    msg.textContent = text;
  }
  function clearMsg() { if (msg) msg.className = "msg"; }

  // Step 1 — request OTP
  sendBtn.addEventListener("click", async function () {
    clearMsg();
    var phone = (phoneInput.value || "").trim();
    if (phone.replace(/\D/g, "").length < 10) { show("err", "Enter a valid phone number."); return; }
    if (mode === "register" && !chosenRole) { show("err", "Choose a role to continue."); return; }
    if (mode === "register") {
      var name = root.querySelector("#name");
      if (name && !name.value.trim()) { show("err", "Please enter your name."); return; }
      var consent = root.querySelector("#consent");
      if (consent && !consent.checked) { show("err", "Please accept the Terms and Privacy Policy."); return; }
    }
    sendBtn.disabled = true; sendBtn.textContent = "Sending…";
    try {
      var r = await api.post("/auth/request-otp", { phone: phone, role: chosenRole });
      // pilot mode: show the OTP so it can be entered
      if (r.pilot_otp && otpHint && otpCode) { otpCode.textContent = r.pilot_otp; otpHint.classList.remove("hidden"); }
      stepPhone.classList.add("hidden");
      stepOtp.classList.remove("hidden");
      otpInput.focus();
    } catch (e) {
      show("err", e.message);
    } finally {
      sendBtn.disabled = false; sendBtn.textContent = "Send OTP";
    }
  });

  // Step 2 — verify OTP
  verifyBtn.addEventListener("click", async function () {
    clearMsg();
    var code = (otpInput.value || "").trim();
    if (code.length < 4) { show("err", "Enter the 6-digit OTP."); return; }
    verifyBtn.disabled = true; verifyBtn.textContent = "Verifying…";
    var payload = { phone: phoneInput.value.trim(), code: code, role: chosenRole };
    if (mode === "register") {
      var name = root.querySelector("#name");
      var gst = root.querySelector("#gst");
      payload.name = name ? name.value.trim() : "";
      payload.consent = true;
      if (gst && gst.value.trim()) payload.gst = gst.value.trim();
    }
    try {
      await api.post("/auth/verify-otp", payload);
      location.href = "dashboard.html";
    } catch (e) {
      show("err", e.message);
      verifyBtn.disabled = false; verifyBtn.textContent = "Verify & continue";
    }
  });

  // allow Enter to advance
  phoneInput && phoneInput.addEventListener("keydown", function (e) { if (e.key === "Enter") sendBtn.click(); });
  otpInput && otpInput.addEventListener("keydown", function (e) { if (e.key === "Enter") verifyBtn.click(); });
})();

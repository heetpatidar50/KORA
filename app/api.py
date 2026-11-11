"""JSON API handlers for KORA.

Each handler returns (status_code, payload). Payload may carry two private
keys that the server acts on and strips before sending:
  "_session": <token>   -> set the session cookie
  "_logout": True       -> clear the session cookie
"""
import time

from . import auth
from .db import get_conn

ROLES = ("farmer", "buyer", "supplier")
SERVICE_KINDS = ("transport", "quality", "machinery", "warehouse")


# ---------- helpers ----------
def _err(status, message):
    return status, {"error": message}


def _num(v, default=None):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _clean(s, limit=400):
    if s is None:
        return None
    return str(s).strip()[:limit]


def _public_user(u):
    return {"id": u["id"], "name": u["name"], "role": u["role"],
            "phone": u["phone"], "gst": u.get("gst")}


# ---------- auth ----------
def request_otp(body):
    phone = body.get("phone")
    role = body.get("role")
    if role is not None and role not in ROLES:
        return _err(400, "Invalid role.")
    if not auth.valid_phone(phone):
        return _err(400, "Enter a valid phone number (10–15 digits).")
    code = auth.generate_otp(phone, role)
    # Pilot mode: no SMS gateway, so the OTP is returned and printed server-side.
    print("  [OTP] %s -> %s" % (auth.normalise_phone(phone), code))
    return 200, {"ok": True, "pilot_otp": code,
                 "message": "OTP generated (pilot mode — shown on screen; no SMS sent)."}


def verify_otp(body):
    phone = auth.normalise_phone(body.get("phone"))
    code = body.get("code")
    if not auth.valid_phone(phone):
        return _err(400, "Enter a valid phone number.")
    result = auth.verify_otp(phone, code)
    if result is False:
        return _err(401, "Incorrect or expired OTP.")

    conn = get_conn()
    try:
        existing = conn.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
        if existing:
            user_id = existing["id"]
        else:
            role = body.get("role") or (result if isinstance(result, str) else None)
            if role not in ROLES:
                return _err(400, "Choose a role to register (farmer, buyer or supplier).")
            name = _clean(body.get("name"), 120)
            if not name:
                return _err(400, "Name is required to register.")
            if not body.get("consent"):
                return _err(400, "Please accept the Terms and Privacy Policy to continue.")
            gst = _clean(body.get("gst"), 20) if role in ("buyer", "supplier") else None
            cur = conn.execute(
                "INSERT INTO users(phone, role, name, gst, created_at) VALUES (?,?,?,?,?)",
                (phone, role, name, gst, time.time()),
            )
            user_id = cur.lastrowid
            conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    finally:
        conn.close()

    token = auth.create_session(user_id)
    return 200, {"user": _public_user(dict(row)), "_session": token,
                 "new_account": existing is None}


def logout():
    return 200, {"ok": True, "_logout": True}


def me(user):
    # signed out is a normal answer here (the landing page asks on every visit), not an error
    if not user:
        return 200, {"user": None}
    return 200, {"user": _public_user(user)}


def delete_account(user):
    if not user:
        return _err(401, "Not signed in.")
    conn = get_conn()
    try:
        conn.execute("DELETE FROM users WHERE id=?", (user["id"],))  # cascades
        conn.commit()
    finally:
        conn.close()
    return 200, {"ok": True, "_logout": True, "message": "Account and related data deleted."}


# ---------- listings ----------
def list_listings(user):
    if not user:
        return _err(401, "Sign in to view listings.")
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT l.*, u.name AS farmer_name, u.location AS fl,
                      (SELECT COUNT(*) FROM bids b WHERE b.listing_id=l.id) AS bid_count
               FROM listings l JOIN users u ON u.id=l.farmer_id
               WHERE l.status='active' ORDER BY l.created_at DESC""" ,
        ).fetchall()
    except Exception:
        # users has no 'location' column; re-run without it
        rows = conn.execute(
            """SELECT l.*, u.name AS farmer_name,
                      (SELECT COUNT(*) FROM bids b WHERE b.listing_id=l.id) AS bid_count
               FROM listings l JOIN users u ON u.id=l.farmer_id
               WHERE l.status='active' ORDER BY l.created_at DESC""" ,
        ).fetchall()
    finally:
        conn.close()
    return 200, {"listings": [dict(r) for r in rows]}


def create_listing(user, body):
    if not user:
        return _err(401, "Sign in first.")
    if user["role"] != "farmer":
        return _err(403, "Only farmers can create produce listings.")
    crop = _clean(body.get("crop"), 80)
    qty = _num(body.get("quantity_kg"))
    price = _num(body.get("price_per_kg"))
    if not crop:
        return _err(400, "Crop is required.")
    if not qty or qty <= 0:
        return _err(400, "Quantity (kg) must be greater than 0.")
    if price is None or price < 0:
        return _err(400, "Enter a valid indicative price per kg.")
    conn = get_conn()
    try:
        cur = conn.execute(
            """INSERT INTO listings(farmer_id, crop, variety, quantity_kg, grade,
                 price_per_kg, location, harvest_date, status, created_at)
               VALUES (?,?,?,?,?,?,?,?, 'active', ?)""",
            (user["id"], crop, _clean(body.get("variety"), 80), qty,
             _clean(body.get("grade"), 40), price, _clean(body.get("location"), 120),
             _clean(body.get("harvest_date"), 40), time.time()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM listings WHERE id=?", (cur.lastrowid,)).fetchone()
    finally:
        conn.close()
    return 201, {"listing": dict(row)}


def my_listings(user):
    if not user or user["role"] != "farmer":
        return _err(403, "Farmers only.")
    conn = get_conn()
    try:
        listings = conn.execute(
            "SELECT * FROM listings WHERE farmer_id=? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
        out = []
        for l in listings:
            bids = conn.execute(
                """SELECT b.*, u.name AS buyer_name FROM bids b
                   JOIN users u ON u.id=b.buyer_id
                   WHERE b.listing_id=? ORDER BY b.price_per_kg DESC, b.created_at ASC""",
                (l["id"],),
            ).fetchall()
            d = dict(l)
            d["bids"] = [dict(b) for b in bids]
            out.append(d)
    finally:
        conn.close()
    return 200, {"listings": out}


def close_listing(user, listing_id):
    if not user or user["role"] != "farmer":
        return _err(403, "Farmers only.")
    conn = get_conn()
    try:
        l = conn.execute("SELECT * FROM listings WHERE id=?", (listing_id,)).fetchone()
        if not l or l["farmer_id"] != user["id"]:
            return _err(404, "Listing not found.")
        conn.execute("UPDATE listings SET status='closed' WHERE id=?", (listing_id,))
        conn.commit()
    finally:
        conn.close()
    return 200, {"ok": True}


# ---------- bids ----------
def create_bid(user, listing_id, body):
    if not user:
        return _err(401, "Sign in first.")
    if user["role"] != "buyer":
        return _err(403, "Only buyers can place bids.")
    price = _num(body.get("price_per_kg"))
    qty = _num(body.get("quantity_kg"))
    if price is None or price <= 0:
        return _err(400, "Enter a valid bid price per kg.")
    conn = get_conn()
    try:
        l = conn.execute("SELECT * FROM listings WHERE id=?", (listing_id,)).fetchone()
        if not l or l["status"] != "active":
            return _err(404, "Listing not available.")
        if not qty or qty <= 0:
            qty = l["quantity_kg"]
        cur = conn.execute(
            """INSERT INTO bids(listing_id, buyer_id, price_per_kg, quantity_kg,
                 message, status, created_at) VALUES (?,?,?,?,?, 'pending', ?)""",
            (listing_id, user["id"], price, qty, _clean(body.get("message"), 240), time.time()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM bids WHERE id=?", (cur.lastrowid,)).fetchone()
    finally:
        conn.close()
    return 201, {"bid": dict(row)}


def my_bids(user):
    if not user or user["role"] != "buyer":
        return _err(403, "Buyers only.")
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT b.*, l.crop, l.variety, l.grade, u.name AS farmer_name
               FROM bids b JOIN listings l ON l.id=b.listing_id
               JOIN users u ON u.id=l.farmer_id
               WHERE b.buyer_id=? ORDER BY b.created_at DESC""",
            (user["id"],),
        ).fetchall()
    finally:
        conn.close()
    return 200, {"bids": [dict(r) for r in rows]}


def decide_bid(user, bid_id, decision):
    if not user or user["role"] != "farmer":
        return _err(403, "Farmers only.")
    if decision not in ("accepted", "rejected"):
        return _err(400, "Invalid decision.")
    conn = get_conn()
    try:
        row = conn.execute(
            """SELECT b.*, l.farmer_id FROM bids b
               JOIN listings l ON l.id=b.listing_id WHERE b.id=?""", (bid_id,),
        ).fetchone()
        if not row or row["farmer_id"] != user["id"]:
            return _err(404, "Bid not found.")
        conn.execute("UPDATE bids SET status=? WHERE id=?", (decision, bid_id))
        if decision == "accepted":
            # close the listing and reject the other pending bids
            conn.execute("UPDATE listings SET status='closed' WHERE id=?", (row["listing_id"],))
            conn.execute(
                "UPDATE bids SET status='rejected' WHERE listing_id=? AND id<>? AND status='pending'",
                (row["listing_id"], bid_id),
            )
        conn.commit()
    finally:
        conn.close()
    return 200, {"ok": True}


# ---------- service requests ----------
def list_service_requests(user):
    if not user:
        return _err(401, "Sign in first.")
    conn = get_conn()
    try:
        if user["role"] == "supplier":
            rows = conn.execute(
                """SELECT s.*, u.name AS requester_name FROM service_requests s
                   JOIN users u ON u.id=s.user_id
                   WHERE s.status IN ('open','responding') ORDER BY s.created_at DESC""",
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT s.*, u.name AS requester_name FROM service_requests s
                   JOIN users u ON u.id=s.user_id
                   WHERE s.user_id=? ORDER BY s.created_at DESC""",
                (user["id"],),
            ).fetchall()
    finally:
        conn.close()
    return 200, {"requests": [dict(r) for r in rows]}


def create_service_request(user, body):
    if not user:
        return _err(401, "Sign in first.")
    if user["role"] == "supplier":
        return _err(403, "Suppliers respond to requests rather than create them.")
    kind = body.get("kind")
    if kind not in SERVICE_KINDS:
        return _err(400, "Choose transport, quality, machinery or warehouse.")
    title = _clean(body.get("title"), 120)
    if not title:
        return _err(400, "A short title is required.")
    conn = get_conn()
    try:
        cur = conn.execute(
            """INSERT INTO service_requests(user_id, kind, title, details, status, created_at)
               VALUES (?,?,?,?, 'open', ?)""",
            (user["id"], kind, title, _clean(body.get("details"), 400), time.time()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM service_requests WHERE id=?", (cur.lastrowid,)).fetchone()
    finally:
        conn.close()
    return 201, {"request": dict(row)}


def respond_service_request(user, req_id):
    if not user or user["role"] != "supplier":
        return _err(403, "Suppliers only.")
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM service_requests WHERE id=?", (req_id,)).fetchone()
        if not row:
            return _err(404, "Request not found.")
        conn.execute(
            "UPDATE service_requests SET status='responding', responder_id=? WHERE id=?",
            (user["id"], req_id),
        )
        conn.commit()
    finally:
        conn.close()
    return 200, {"ok": True}


# ---------- dashboard stats ----------
def stats(user):
    if not user:
        return _err(401, "Sign in first.")
    conn = get_conn()
    try:
        def one(q, *a):
            return conn.execute(q, a).fetchone()[0]
        data = {
            "active_listings": one("SELECT COUNT(*) FROM listings WHERE status='active'"),
            "total_bids": one("SELECT COUNT(*) FROM bids"),
            "open_requests": one("SELECT COUNT(*) FROM service_requests WHERE status='open'"),
        }
        if user["role"] == "farmer":
            data["my_listings"] = one("SELECT COUNT(*) FROM listings WHERE farmer_id=?", user["id"])
            data["bids_received"] = one(
                "SELECT COUNT(*) FROM bids b JOIN listings l ON l.id=b.listing_id WHERE l.farmer_id=?",
                user["id"])
        elif user["role"] == "buyer":
            data["my_bids"] = one("SELECT COUNT(*) FROM bids WHERE buyer_id=?", user["id"])
            data["accepted"] = one("SELECT COUNT(*) FROM bids WHERE buyer_id=? AND status='accepted'", user["id"])
        else:
            data["requests_responding"] = one(
                "SELECT COUNT(*) FROM service_requests WHERE responder_id=?", user["id"])
    finally:
        conn.close()
    return 200, {"stats": data}


# ---------- router ----------
def dispatch(method, parts, body, user):
    """parts: path segments after /api, e.g. ['listings','3','bids']"""
    n = len(parts)
    head = parts[0] if parts else ""

    if head == "auth":
        sub = parts[1] if n > 1 else ""
        if method == "POST" and sub == "request-otp":
            return request_otp(body)
        if method == "POST" and sub == "verify-otp":
            return verify_otp(body)
        if method == "POST" and sub == "logout":
            return logout()
        return _err(404, "Unknown auth route.")

    if head == "me" and method == "GET":
        return me(user)

    if head == "account" and method == "DELETE":
        return delete_account(user)

    if head == "stats" and method == "GET":
        return stats(user)

    if head == "listings":
        if n == 1 and method == "GET":
            return list_listings(user)
        if n == 1 and method == "POST":
            return create_listing(user, body)
        if n == 2 and parts[1] == "mine" and method == "GET":
            return my_listings(user)
        if n == 2 and method == "DELETE":
            return close_listing(user, _int(parts[1]))
        if n == 3 and parts[2] == "bids" and method == "POST":
            return create_bid(user, _int(parts[1]), body)
    if head == "bids":
        if n == 2 and parts[1] == "mine" and method == "GET":
            return my_bids(user)
        if n == 3 and method == "POST" and parts[2] in ("accept", "reject"):
            return decide_bid(user, _int(parts[1]), "accepted" if parts[2] == "accept" else "rejected")

    if head == "service-requests":
        if n == 1 and method == "GET":
            return list_service_requests(user)
        if n == 1 and method == "POST":
            return create_service_request(user, body)
        if n == 3 and parts[2] == "respond" and method == "POST":
            return respond_service_request(user, _int(parts[1]))

    return _err(404, "Unknown API route.")


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return -1

"""OTP generation, verification and session handling (pilot, standard library)."""
import secrets
import time

from .db import get_conn

OTP_TTL = 300          # 5 minutes
SESSION_TTL = 60 * 60 * 24 * 7  # 7 days
COOKIE_NAME = "kora_session"


def normalise_phone(phone):
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    return digits


def valid_phone(phone):
    return 10 <= len(normalise_phone(phone)) <= 15


def generate_otp(phone, role=None):
    """Create a 6-digit OTP. In this pilot the code is returned to the caller
    (no SMS gateway), matching the platform's 'simulated data' disclosure."""
    code = "%06d" % secrets.randbelow(1_000_000)
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO otps(phone, code, role, expires_at, used) VALUES (?,?,?,?,0)",
            (normalise_phone(phone), code, role, time.time() + OTP_TTL),
        )
        conn.commit()
    finally:
        conn.close()
    return code


def verify_otp(phone, code):
    """Return the role stored with the OTP (may be None) on success, else False."""
    conn = get_conn()
    try:
        row = conn.execute(
            """SELECT * FROM otps
               WHERE phone=? AND code=? AND used=0 AND expires_at > ?
               ORDER BY id DESC LIMIT 1""",
            (normalise_phone(phone), str(code), time.time()),
        ).fetchone()
        if not row:
            return False
        conn.execute("UPDATE otps SET used=1 WHERE id=?", (row["id"],))
        conn.commit()
        return row["role"] or True
    finally:
        conn.close()


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO sessions(token, user_id, created_at) VALUES (?,?,?)",
            (token, user_id, time.time()),
        )
        conn.commit()
    finally:
        conn.close()
    return token


def user_for_token(token):
    if not token:
        return None
    conn = get_conn()
    try:
        row = conn.execute(
            """SELECT u.* FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.token = ? AND s.created_at > ?""",
            (token, time.time() - SESSION_TTL),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def destroy_session(token):
    if not token:
        return
    conn = get_conn()
    try:
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))
        conn.commit()
    finally:
        conn.close()

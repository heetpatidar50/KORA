"""SQLite storage for KORA (standard library only)."""
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("KORA_DB", os.path.join(BASE_DIR, "kora.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    phone       TEXT UNIQUE NOT NULL,
    role        TEXT NOT NULL,                 -- farmer | buyer | supplier
    name        TEXT NOT NULL,
    gst         TEXT,
    created_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    created_at  REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    phone       TEXT NOT NULL,
    code        TEXT NOT NULL,
    role        TEXT,
    expires_at  REAL NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS listings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id     INTEGER NOT NULL,
    crop          TEXT NOT NULL,
    variety       TEXT,
    quantity_kg   REAL NOT NULL,
    grade         TEXT,
    price_per_kg  REAL NOT NULL,
    location      TEXT,
    harvest_date  TEXT,
    status        TEXT NOT NULL DEFAULT 'active',  -- active | closed
    created_at    REAL NOT NULL,
    FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bids (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id    INTEGER NOT NULL,
    buyer_id      INTEGER NOT NULL,
    price_per_kg  REAL NOT NULL,
    quantity_kg   REAL NOT NULL,
    message       TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
    created_at    REAL NOT NULL,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id)   REFERENCES users(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    kind        TEXT NOT NULL,                 -- transport | quality | machinery | warehouse
    title       TEXT NOT NULL,
    details     TEXT,
    status      TEXT NOT NULL DEFAULT 'open',  -- open | responding | closed
    responder_id INTEGER,
    created_at  REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()

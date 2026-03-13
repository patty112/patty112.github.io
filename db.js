const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "reviews.db");

// Ensure data directory exists
const fs = require("fs");
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    movie     TEXT    NOT NULL,
    reviewer  TEXT    NOT NULL,
    score     REAL    NOT NULL CHECK (score >= 1 AND score <= 10),
    review    TEXT    NOT NULL,
    poster    TEXT,
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviewers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    NOT NULL UNIQUE,
    display_name TEXT    NOT NULL,
    password_hash TEXT   NOT NULL,
    created_at   TEXT   NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Seed sample reviews (only if table is empty) ──────
const count = db.prepare("SELECT COUNT(*) as n FROM reviews").get();
if (count.n === 0) {
  const insert = db.prepare(`
    INSERT INTO reviews (movie, reviewer, score, review, created_at)
    VALUES (@movie, @reviewer, @score, @review, @created_at)
  `);
  const seed = db.transaction(() => {
    insert.run({ movie: "Dune: Part Two",   reviewer: "patrick", score: 9, review: "Villeneuve delivered. The sandworm ride scene alone is worth the ticket. Zendaya finally gets something to do.", created_at: "2024-03-10 00:00:00" });
    insert.run({ movie: "Oppenheimer",      reviewer: "jimmy",   score: 8, review: "Three hours flew by. Cillian Murphy carries every scene. The Trinity test sequence is unlike anything I've seen.", created_at: "2023-08-05 00:00:00" });
    insert.run({ movie: "The Holdovers",    reviewer: "ryland",  score: 9, review: "Didn't expect to cry. Paul Giamatti is doing something special here. One of the best films in years.", created_at: "2024-01-14 00:00:00" });
    insert.run({ movie: "Saltburn",         reviewer: "jose",    score: 7, review: "Wildly uneven but I couldn't look away. Barry Keoghan is creepy in the best way. The ending goes for it.", created_at: "2024-01-20 00:00:00" });
    insert.run({ movie: "Poor Things",      reviewer: "kris",    score: 8, review: "Weird as hell and I loved it. Emma Stone deserved the Oscar. Lanthimos in full fever-dream mode.", created_at: "2024-02-02 00:00:00" });
  });
  seed();
  console.log("✓ Database seeded with sample reviews");
}

module.exports = db;

/**
 * Run once to migrate your existing database to support decimal scores:
 *   node scripts/migrate_decimal_scores.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const Database = require("better-sqlite3");
const path     = require("path");

const DB_PATH = path.join(__dirname, "../data/reviews.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

console.log("\n🎬  Migrating scores to support decimals...\n");

db.exec(`
  BEGIN;

  -- Rename old table
  ALTER TABLE reviews RENAME TO reviews_old;

  -- Create new table with REAL score
  CREATE TABLE reviews (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    movie     TEXT    NOT NULL,
    reviewer  TEXT    NOT NULL,
    score     REAL    NOT NULL CHECK (score >= 1 AND score <= 10),
    review    TEXT    NOT NULL,
    poster    TEXT,
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
  );

  -- Copy data across
  INSERT INTO reviews SELECT * FROM reviews_old;

  -- Drop old table
  DROP TABLE reviews_old;

  COMMIT;
`);

const count = db.prepare("SELECT COUNT(*) as n FROM reviews").get();
console.log(`✓ Migration complete. ${count.n} reviews preserved.\n`);
console.log("You can now use decimal scores like 7.5, 8.3, 9.1 etc.\n");
process.exit(0);

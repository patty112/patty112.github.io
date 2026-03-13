/**
 * Run once after first install to create reviewer accounts:
 *   node scripts/setup.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt   = require("bcryptjs");
const readline = require("readline");
const db       = require("../db");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(res => rl.question(q, res));

const REVIEWERS = ["patrick", "jimmy", "ryland", "jose", "kris"];

async function main() {
  console.log("\n🎬  Hugh Movies — Reviewer Account Setup\n");
  console.log("This will create (or update) password-protected accounts for all reviewers.\n");

  for (const username of REVIEWERS) {
    const existing = db.prepare("SELECT id FROM reviewers WHERE username = ?").get(username);
    const action   = existing ? "Update" : "Create";

    const displayName = username.charAt(0).toUpperCase() + username.slice(1);
    const password    = await ask(`${action} password for ${displayName} (leave blank to skip): `);

    if (!password.trim()) {
      console.log(`  → Skipped ${displayName}\n`);
      continue;
    }
    if (password.length < 8) {
      console.log(`  ✗ Password must be at least 8 characters. Skipping ${displayName}.\n`);
      continue;
    }

    const hash = bcrypt.hashSync(password, 12);

    if (existing) {
      db.prepare("UPDATE reviewers SET password_hash = ? WHERE username = ?").run(hash, username);
    } else {
      db.prepare("INSERT INTO reviewers (username, display_name, password_hash) VALUES (?, ?, ?)")
        .run(username, displayName, hash);
    }

    console.log(`  ✓ ${displayName} account saved.\n`);
  }

  console.log("Setup complete. Start the server with: npm start\n");
  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});

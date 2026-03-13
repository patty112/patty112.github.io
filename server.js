require("dotenv").config();
const express = require("express");
const path    = require("path");
const cors    = require("cors");

// ─── Validate required env vars ────────────────────────
const REQUIRED = ["JWT_SECRET"];
REQUIRED.forEach(key => {
  if (!process.env[key]) {
    console.error(`\n❌ Missing required environment variable: ${key}`);
    console.error("   Copy .env.example to .env and fill in the values.\n");
    process.exit(1);
  }
});

if (process.env.JWT_SECRET.length < 32) {
  console.error("\n❌ JWT_SECRET must be at least 32 characters long.\n");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────────────
app.use(cors());                       // Adjust origin in production
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// ─── Rate limiting (simple in-memory) ──────────────────
const loginAttempts = new Map(); // ip -> { count, resetAt }

function loginRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const WINDOW = 15 * 60 * 1000; // 15 minutes
  const MAX    = 10;              // 10 attempts per window

  const entry = loginAttempts.get(ip);
  if (entry) {
    if (now > entry.resetAt) {
      loginAttempts.delete(ip);
    } else if (entry.count >= MAX) {
      const wait = Math.ceil((entry.resetAt - now) / 60000);
      return res.status(429).json({ error: `Too many login attempts. Try again in ${wait} minute(s).` });
    }
  }

  res.on("finish", () => {
    if (res.statusCode === 401) {
      const current = loginAttempts.get(ip) || { count: 0, resetAt: now + WINDOW };
      loginAttempts.set(ip, { count: current.count + 1, resetAt: current.resetAt });
    }
  });

  next();
}

// ─── Routes ────────────────────────────────────────────
app.use("/api/auth",    loginRateLimit, require("./routes/auth"));
app.use("/api/reviews",                require("./routes/reviews"));

// Catch-all: serve frontend for any non-API route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Error handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start ─────────────────────────────────────────────
// Initialize DB before accepting connections
require("./db");

app.listen(PORT, () => {
  console.log(`\n🎬 Pattysite running at http://localhost:${PORT}`);
  console.log(`   Reviews API: http://localhost:${PORT}/api/reviews\n`);
});

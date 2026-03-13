const express = require("express");
const db      = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Valid reviewer usernames (kept in sync with the reviewers table)
const VALID_REVIEWERS = ["patrick", "jimmy", "ryland", "jose", "kris"];

// ─── GET /api/reviews ───────────────────────────────────
// Query params: ?search=&reviewer=&sort=newest|high|low
// Public — no auth required
router.get("/", (req, res) => {
  const { search = "", reviewer = "all", sort = "newest" } = req.query;

  let query = "SELECT * FROM reviews WHERE 1=1";
  const params = [];

  if (search.trim()) {
    query += " AND (LOWER(movie) LIKE ? OR LOWER(review) LIKE ?)";
    const term = `%${search.toLowerCase().trim()}%`;
    params.push(term, term);
  }

  if (reviewer !== "all" && VALID_REVIEWERS.includes(reviewer)) {
    query += " AND reviewer = ?";
    params.push(reviewer);
  }

  if (sort === "high") {
    query += " ORDER BY score DESC, created_at DESC";
  } else if (sort === "low") {
    query += " ORDER BY score ASC, created_at DESC";
  } else {
    query += " ORDER BY created_at DESC";
  }

  const reviews = db.prepare(query).all(...params);
  res.json(reviews);
});

// ─── GET /api/reviews/:id ───────────────────────────────
router.get("/:id", (req, res) => {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  if (!review) return res.status(404).json({ error: "Review not found." });
  res.json(review);
});

// ─── POST /api/reviews ─────────────────────────────────
// Auth required. Body: { movie, score, review, poster? }
// reviewer is taken from the authenticated user's token
router.post("/", requireAuth, (req, res) => {
  const { movie, score, review, poster } = req.body;
  const reviewer = req.user.username;

  // Validation
  if (!movie || typeof movie !== "string" || !movie.trim()) {
    return res.status(400).json({ error: "Movie title is required." });
  }
  if (!review || typeof review !== "string" || !review.trim()) {
    return res.status(400).json({ error: "Review text is required." });
  }
  const scoreNum = parseFloat(score);
  const rounded = Math.round(scoreNum * 10) / 10;
  if (isNaN(rounded) || rounded < 1 || rounded > 10) {
    return res.status(400).json({ error: "Score must be a number between 1 and 10." });
  }
  if (poster && typeof poster !== "string") {
    return res.status(400).json({ error: "Invalid poster URL." });
  }

  const result = db.prepare(`
    INSERT INTO reviews (movie, reviewer, score, review, poster)
    VALUES (?, ?, ?, ?, ?)
  `).run(movie.trim(), reviewer, Math.round(parseFloat(score) * 10) / 10, review.trim(), poster || null);

  const created = db.prepare("SELECT * FROM reviews WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// ─── DELETE /api/reviews/:id ────────────────────────────
// Auth required. Users can only delete their own reviews.
router.delete("/:id", requireAuth, (req, res) => {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);

  if (!review) {
    return res.status(404).json({ error: "Review not found." });
  }
  if (review.reviewer !== req.user.username) {
    return res.status(403).json({ error: "You can only delete your own reviews." });
  }

  db.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
  res.json({ message: "Review deleted." });
});

// ─── PATCH /api/reviews/:id ─────────────────────────────
// Auth required. Users can only edit their own reviews.
router.patch("/:id", requireAuth, (req, res) => {
  const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);

  if (!review) {
    return res.status(404).json({ error: "Review not found." });
  }
  if (review.reviewer !== req.user.username) {
    return res.status(403).json({ error: "You can only edit your own reviews." });
  }

  const { movie, score, review: reviewText, poster } = req.body;

  const updates = {};
  if (movie   !== undefined) updates.movie  = movie.trim();
  if (reviewText !== undefined) updates.review = reviewText.trim();
  if (poster  !== undefined) updates.poster = poster || null;
  if (score   !== undefined) {
    const s = Math.round(parseFloat(score) * 10) / 10;
    if (isNaN(s) || s < 1 || s > 10) {
      return res.status(400).json({ error: "Score must be 1–10." });
    }
    updates.score = s;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
  const values     = [...Object.values(updates), req.params.id];

  db.prepare(`UPDATE reviews SET ${setClauses} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
  res.json(updated);
});

module.exports = router;

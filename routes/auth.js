const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const db      = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const TOKEN_TTL = "8h";

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const reviewer = db
    .prepare("SELECT * FROM reviewers WHERE username = ?")
    .get(username.toLowerCase().trim());
  if (!reviewer) {
    bcrypt.compare(password, "$2a$12$invalidhashpadding000000000000000000000000000000000000000");
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const valid = bcrypt.compareSync(password, reviewer.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = jwt.sign(
    { username: reviewer.username, displayName: reviewer.display_name },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
  res.json({
    token,
    user: { username: reviewer.username, displayName: reviewer.display_name }
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  const reviewer = db
    .prepare("SELECT * FROM reviewers WHERE username = ?")
    .get(req.user.username);
  const valid = bcrypt.compareSync(currentPassword, reviewer.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare("UPDATE reviewers SET password_hash = ? WHERE username = ?")
    .run(newHash, req.user.username);
  res.json({ message: "Password updated successfully." });
});

module.exports = router;
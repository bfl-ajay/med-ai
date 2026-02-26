const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/diseases?search=dia
router.get('/', async (req, res) => {
  const search = req.query.search || '';

  try {
    const [rows] = await db.execute(
      "SELECT name FROM diseases WHERE name LIKE ? LIMIT 10",
      [`%${search}%`]
    );

    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
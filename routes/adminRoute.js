const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { checkAdmin } = require('../middleware/authMiddleware');

// Get all content for admin panel
router.get('/content', checkAdmin, async (req, res) => {
  try {
    const [artists, heroImages] = await Promise.all([
      pool.query('SELECT * FROM artists ORDER BY category, name'),
      pool.query('SELECT * FROM hero_images ORDER BY order_position')
    ]);
    
    res.json({
      artists: artists.rows,
      heroImages: heroImages.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new artist
router.post('/artists', checkAdmin, async (req, res) => {
  const { name, image_url, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO artists (name, image_url, category) VALUES ($1, $2, $3) RETURNING *',
      [name, image_url, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update artist
router.put('/artists/:id', checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, image_url, category } = req.body;
  try {
    const result = await pool.query(
      'UPDATE artists SET name = $1, image_url = $2, category = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, image_url, category, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete artist
router.delete('/artists/:id', checkAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM artists WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Similar endpoints for hero_images (create, update, delete)

module.exports = router;


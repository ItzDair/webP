const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const multer = require('multer');
const path = require('path');

router.get('/', (req, res) => {
    res.json({ message: "API v1 working" });
});

// Configure multer to use memory storage
const uploadArtistImage = multer({ 
  storage: multer.memoryStorage(), // Store in memory first
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET all artists (now returns base64 encoded images)
router.get('/artists', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, 
        name, 
        category, 
        description,
        CASE 
          WHEN image_data IS NOT NULL 
          THEN 'data:' || image_mime_type || ';base64,' || encode(image_data, 'base64') 
          ELSE NULL 
        END as image_url
      FROM artists
    `);
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST new artist with image upload
router.post('/artists', uploadArtistImage.single('image'), async (req, res) => {
  try {
    const { name, category, description } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ 
        error: "Missing required fields (name, category)" 
      });
    }

    // Prepare image data for database
    const image_data = req.file ? req.file.buffer : null;
    const image_mime_type = req.file ? req.file.mimetype : null;

    const { rows } = await pool.query(
      `INSERT INTO artists 
        (name, category, description, image_data, image_mime_type) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, category, description`,
      [name, category, description || null, image_data, image_mime_type]
    );
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      error: "Failed to create artist",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// PUT - Update artist with optional image
router.put('/artists/:id', uploadArtistImage.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    // Check if artist exists first
    const existingArtist = await pool.query('SELECT id FROM artists WHERE id = $1', [id]);
    if (existingArtist.rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Prepare update query based on whether new image was uploaded
    let query, params;
    if (req.file) {
      query = `
        UPDATE artists 
        SET name = $1,
            category = $2,
            description = $3,
            image_data = $4,
            image_mime_type = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, name, category, description`;
      params = [name, category, description || null, req.file.buffer, req.file.mimetype, id];
    } else {
      query = `
        UPDATE artists 
        SET name = $1,
            category = $2,
            description = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, name, category, description`;
      params = [name, category, description || null, id];
    }

    const { rows } = await pool.query(query, params);

    res.json(rows[0]);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      error: 'Failed to update artist',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// DELETE artist (unchanged)
router.delete('/artists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const artist = await pool.query('SELECT id FROM artists WHERE id = $1', [id]);
    if (artist.rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    await pool.query('DELETE FROM artists WHERE id = $1', [id]);

    res.status(200).json({ 
      success: true,
      message: 'Artist deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete artist',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
const { Pool } = require('pg');
require('dotenv').config(); // Add this to load .env

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT || 5432, // Default port
  max: 20, // Max connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if DB is unreachable
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: true // Never disable in production without CA
  } : false
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Database connection failed:', err);
  }
  console.log('✅ Database connected successfully');
  release();
});

// Improved error handling
pool.on('error', (err) => {
  console.error('Database error:', err.message);
  // Don't exit in production (could crash the app)
  if (process.env.NODE_ENV !== 'production') process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');
    // Verify tables exist
    // In connection.js, update the table creation query:
    pool.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        image_data BYTEA,  -- This will store the binary image data
        image_mime_type VARCHAR(50),  -- Store the MIME type
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(console.error);
  }
});

module.exports = pool;

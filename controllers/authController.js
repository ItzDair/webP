const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Token generator
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });
};

// User registration
const createUser = [
  body('username')
    .exists().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username too short'),

  body('email')
    .exists().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),

  body('password')
    .exists().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password too short'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;

      // Check for existing user
      const userExists = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (userExists.rows.length) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const { rows } = await pool.query(
        `INSERT INTO users (username, email, password, avatar, is_admin)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, avatar, is_admin`,
        [username, email, hashedPassword, req.body.avatar || null, false] // Default to non-admin
      );

      const token = generateToken(rows[0].id);

      res.status(201).json({
        success: true,
        user: rows[0],
        token
      });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({
        error: 'Registration failed',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
];

// User login with admin check
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT id, username, email, password, avatar, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    // Return user data including admin status
    res.json({
      success: true,
      user: { 
        id: user.id, 
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        is_admin: user.is_admin
      },
      token
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Admin status check middleware
const checkAdmin = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [decoded.id],
      (err, result) => {
        if (err || !result.rows.length || !result.rows[0].is_admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        next();
      }
    );
  } catch (err) {
    console.error('Admin check error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = {
  createUser,
  login,
  checkAdmin
};
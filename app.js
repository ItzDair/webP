require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
const multer = require('multer'); // Replaced express-fileupload with multer
const cookieParser = require('cookie-parser');

const app = express();

// ======================
// 1. SECURITY MIDDLEWARE
// ======================
app.use(helmet());
app.disable('x-powered-by');

// ======================
// 2. COOKIE PARSER
// ======================
app.use(cookieParser());

// ======================
// 3. CORS CONFIGURATION
// ======================
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// ======================
// 4. RATE LIMITING
// ======================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests'
});
app.use(limiter);

// ======================
// 5. BODY PARSING
// ======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// 6. FILE UPLOAD CONFIGURATION
// ======================
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory as Buffer
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Apply multer middleware to specific routes (not globally)
// This will be used in your apiRoutes.js

// ======================
// 7. STATIC FILES
// ======================
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static assets
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Serve uploaded files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ======================
// 8. LOGGING MIDDLEWARE
// ======================
app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.path}`);
  next();
});

// ======================
// 9. ROUTES
// ======================
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');


app.use('/api/v1', apiRoutes);
app.use('/auth', authRoutes);

// Single test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: "API is working", timestamp: new Date() });
});

// ======================
// 10. ERROR HANDLING
// ======================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// ======================
// SERVER STARTUP
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
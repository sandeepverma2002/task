// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const pool = require('./db');
const keepAlive = require('./KeepAlive'); // Import the keep-alive function

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Start keep-alive ping to prevent database connection from sleeping
keepAlive(); // This will keep the DB connection alive

// Rate Limiter for login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes window
  max: 3, // Allow 3 requests in 5 minutes
  message: 'Too many login attempts, please try again after 5 min later.',
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const token = req.cookies.authToken;
  if (!token) return res.status(401).send('Access Denied');

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Invalid token');
    req.user = user;
    next();
  });
}

// Routes
app.get('/register', (req, res) => {
  res.render('register', { error: null, success: null });
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.render('register', {
      error: 'All fields are required.',
      success: null,
    });
  }
  if (password.length < 8) {
    return res.render('register', {
      error: 'Password must be at least 8 characters.',
      success: null,
    });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO task1 (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hash]
    );
    res.render('register', {
      success: 'Registration successful! Please login.',
      error: null,
    });
  } catch (err) {
    console.error(err);
    res.render('register', {
      error: 'Email already exists or DB error.',
      success: null,
    });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', loginLimiter, async (req, res) => {
  const {
    email,
    password,
    'g-recaptcha-response': recaptchaResponse,
  } = req.body;

  if (!recaptchaResponse) {
    return res.render('login', { error: 'reCAPTCHA is required.' });
  }

  const verifyRes = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET,
        response: recaptchaResponse,
      }),
    }
  );
  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    return res.render('login', { error: 'reCAPTCHA verification failed.' });
  }

  try {
    const result = await pool.query('SELECT * FROM task1 WHERE email = $1', [
      email,
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign(
          { userId: user.id, username: user.username, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );
        res.cookie('authToken', token, { httpOnly: true, sameSite: 'Strict' });
        return res.redirect('/dashboard?success=true');
      }
    }
    res.render('login', { error: 'Invalid credentials.' });
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Login failed. Try again.' });
  }
});

app.get('/dashboard', authenticateToken, (req, res) => {
  const successMessage = req.query.success ? true : false;
  res.render('dashboard', { user: req.user, success: successMessage });
});

app.get('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.redirect('/login');
});

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan'; // HTTP request logger

import { connectDB } from './src/services/database.service.js';
import apiRoutes from './src/routes/api.routes.js';
import supervisorRoutes from './src/routes/supervisor.routes.js';

import './src/scheduler/timeoutChecker.js';


// Load .env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(morgan('dev')); // Logger
app.use(express.json()); // Parse JSON bodies (for our webhooks)
app.use(express.urlencoded({ extended: true })); // Parse HTML forms (from supervisor)

// Setup EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS)
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---
// API routes (webhooks, data fetching)
app.use('/api', apiRoutes);
// Supervisor UI routes (HTML pages)
app.use('/admin', supervisorRoutes);


// Simple root redirect to the admin panel
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`[Backend] Server running on http://localhost:${PORT}`);
});
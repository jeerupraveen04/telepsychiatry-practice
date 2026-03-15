require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory (public front-end)
app.use(express.static(__dirname));

// Also serve the top-level frontend/ directory so requests to /frontend/* work
// (server.js lives in backend/, so __dirname points to backend/). This maps
// URLs like /frontend/index.html -> ../frontend/index.html
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));

// PostgreSQL Connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'telepsychiatry',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Fallback file storage when DB is not available (useful for local testing)
const submissionsFile = path.join(__dirname, 'submissions.json');
let useDb = true;

// Create tables if they don't exist. If DB is unreachable, fall back to file storage.
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS patients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(255),
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                form_data JSONB NOT NULL
            );
        `);
        console.log('Database initialized successfully.');
        useDb = true;
    } catch (err) {
        console.error('Error initializing database, falling back to file storage:', err.message || err);
        useDb = false;
        // Ensure submissions file exists
        try {
            if (!fs.existsSync(submissionsFile)) fs.writeFileSync(submissionsFile, '[]', 'utf8');
        } catch (fsErr) {
            console.error('Unable to create submissions file:', fsErr);
        }
    }
};

initDb();

// --- API ENDPOINTS ---

// Submit new form
app.post('/api/submit', async (req, res) => {
    try {
        const formData = req.body;
        
        // Extract basic identifying info for easy querying
        const name = formData.legalName || 'Unknown Patient';
        const email = formData.emailAddress || '';
        const phone = formData.phoneNumber || '';

        if (useDb) {
            try {
                const result = await pool.query(
                    'INSERT INTO patients (name, email, phone, form_data) VALUES ($1, $2, $3, $4) RETURNING id',
                    [name, email, phone, formData]
                );
                return res.status(201).json({ success: true, id: result.rows[0].id, message: 'Form submitted successfully (db)' });
            } catch (dbErr) {
                console.error('DB write failed, switching to file fallback:', dbErr.message || dbErr);
                useDb = false;
                // fall through to file storage
            }
        }

        // File fallback: append the submission to a local JSON file with a timestamp and generated id
        try {
            let submissions = [];
            const raw = fs.readFileSync(submissionsFile, 'utf8');
            submissions = JSON.parse(raw || '[]');
            const newId = (submissions.length > 0) ? (submissions[submissions.length - 1].id + 1) : 1;
            const record = { id: newId, name, email, phone, form_data: formData, submitted_at: new Date().toISOString() };
            submissions.push(record);
            fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2), 'utf8');
            return res.status(201).json({ success: true, id: newId, message: 'Form submitted successfully (file fallback)' });
        } catch (fileErr) {
            console.error('Error saving submission to file fallback:', fileErr);
            return res.status(500).json({ success: false, error: 'Storage error' });
        }
    } catch (err) {
        console.error('Error saving form data:', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Get all patients (for doctor portal)
app.get('/api/patients', async (req, res) => {
    if (useDb) {
        try {
            const result = await pool.query('SELECT id, name, email, phone, submitted_at FROM patients ORDER BY submitted_at DESC');
            return res.json(result.rows);
        } catch (err) {
            console.error('Error fetching patients from DB:', err);
            // Fallthrough to file fallback if DB fails
        }
    }
    
    // File fallback
    try {
        if (!fs.existsSync(submissionsFile)) {
            return res.json([]);
        }
        const raw = fs.readFileSync(submissionsFile, 'utf8');
        const submissions = JSON.parse(raw || '[]');
        const summaries = submissions.map(sub => ({
            id: sub.id,
            name: sub.name,
            email: sub.email,
            phone: sub.phone,
            submitted_at: sub.submitted_at
        })).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        res.json(summaries);
    } catch (err) {
        console.error('Error fetching patients from file:', err);
        res.status(500).json({ error: 'Storage error' });
    }
});

// Get specific patient data
app.get('/api/patients/:id', async (req, res) => {
    const { id } = req.params;
    if (useDb) {
        try {
            const result = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
            
            if (result.rows.length > 0) {
                 return res.json(result.rows[0]);
            }
        } catch (err) {
            console.error('Error fetching patient data from DB:', err);
            // Fallthrough to file fallback if DB fails
        }
    }
    
    // File fallback
    try {
        if (!fs.existsSync(submissionsFile)) {
             return res.status(404).json({ error: 'Patient not found' });
        }
        const raw = fs.readFileSync(submissionsFile, 'utf8');
        const submissions = JSON.parse(raw || '[]');
        // Convert both to string for comparison as params are strings
        const patient = submissions.find(sub => sub.id.toString() === id);
        
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json(patient);
    } catch (err) {
        console.error('Error fetching patient data from file:', err);
        res.status(500).json({ error: 'Storage error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
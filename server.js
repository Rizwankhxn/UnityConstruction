require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Serve static files
app.use(express.static(path.join(__dirname)));
// Note: We no longer need the /uploads static route because Cloudinary serves the newly uploaded images directly via URL

// =================== CLOUDINARY CONFIG ===================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'unity_construction',
    allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});
const upload = multer({ storage: storage });

// =================== POSTGRES DATABASE CONFIG ===================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Provide a fallback string for local sqlite replacement if preferred, but we use cloud DB here
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : {
        rejectUnauthorized: false // Required for Render/Supabase cloud DB connections
    }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL Database', err.stack);
        console.error('Did you forget to add your DATABASE_URL in the .env file?');
    } else {
        console.log('Connected to PostgreSQL Database.');
        initializeDB();
        release();
    }
});

async function initializeDB() {
    try {
        // Create projects table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                client VARCHAR(255),
                budget NUMERIC,
                "startDate" VARCHAR(50),
                "imageUrl" TEXT
            )
        `);

        // Check if projects table is empty
        const projectsCount = await pool.query('SELECT COUNT(*) FROM projects');
        if (parseInt(projectsCount.rows[0].count) === 0) {
            await pool.query(`INSERT INTO projects (name, type, status, client, budget, "startDate", "imageUrl") VALUES 
                ('Luxury Villa', 'Residential', 'Completed', 'Mr. Smith', 1500000, '2024-01-10', 'assets/images/project1.png'),
                ('Tech Park Office', 'Commercial', 'Ongoing', 'Tech Corp', 5200000, '2024-04-20', 'assets/images/project2.png'),
                ('City Plaza Renovation', 'Remodeling', 'Completed', 'City Council', 850000, '2024-08-05', 'assets/images/project3.png')
            `);
            console.log("Seeded projects table.");
        }

        // Create testimonials table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS testimonials (
                id SERIAL PRIMARY KEY,
                "clientName" VARCHAR(255) NOT NULL,
                review TEXT NOT NULL,
                rating INTEGER DEFAULT 5,
                "isVisible" INTEGER DEFAULT 1
            )
        `);

        // Check if testimonials table is empty
        const testimonialsCount = await pool.query('SELECT COUNT(*) FROM testimonials');
        if (parseInt(testimonialsCount.rows[0].count) === 0) {
            await pool.query(`INSERT INTO testimonials ("clientName", review, rating, "isVisible") VALUES 
                ('Sarah Jenkins', 'UnityConstruction built my dream home beautifully. The team was highly professional and paid attention to every detail!', 5, 1),
                ('Michael Carter', 'Excellent communication and top-notch craftsmanship. Their project management is the best in the business.', 5, 1),
                ('Elena Rodriguez', 'They finished my store remodeling ahead of schedule and precisely within budget. Highly recommended!', 5, 1)
            `);
            console.log("Seeded testimonials table.");
        }
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
}

// ------------------- SECURITY / AUTHENTICATION -------------------

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader === 'Bearer unity-admin-secret-2026') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized Access. Please login.' });
    }
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Hardcoded highly secure credentials for demonstration
    if (username === 'admin' && password === 'admin123') {
        res.json({ message: 'success', token: 'unity-admin-secret-2026' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ------------------- API: PROJECTS -------------------

app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY id DESC');
        res.json({ "message": "success", "data": result.rows });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.get('/api/dashboard/stats', authenticateAdmin, async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as "totalProjects",
                SUM(CASE WHEN status = 'Ongoing' THEN 1 ELSE 0 END) as "ongoingProjects",
                SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as "completedProjects"
            FROM projects
        `;
        const result = await pool.query(statsQuery);
        const row = result.rows[0];
        res.json({
            "message": "success",
            "data": {
                totalProjects: parseInt(row.totalProjects) || 0,
                ongoingProjects: parseInt(row.ongoingProjects) || 0,
                completedProjects: parseInt(row.completedProjects) || 0
            }
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        res.json({ "message": "success", "data": result.rows[0] });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Create Project (with Cloudinary image upload)
app.post('/api/projects', authenticateAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, type, status, client, budget, startDate } = req.body;
        // The Cloudinary URL comes from req.file.path automatically
        let imageUrl = req.file ? req.file.path : null;
        
        const result = await pool.query(
            'INSERT INTO projects (name, type, status, client, budget, "startDate", "imageUrl") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [name, type, status, client, budget, startDate, imageUrl]
        );
        res.json({ "message": "success", "data": { id: result.rows[0].id } });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Update Project (optionally replace image on Cloudinary)
app.put('/api/projects/:id', authenticateAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, type, status, client, budget, startDate } = req.body;
        let imageUrl = req.file ? req.file.path : req.body.existingImage;
        
        await pool.query(
            'UPDATE projects SET name = $1, type = $2, status = $3, client = $4, budget = $5, "startDate" = $6, "imageUrl" = $7 WHERE id = $8',
            [name, type, status, client, budget, startDate, imageUrl, req.params.id]
        );
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.delete('/api/projects/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// ------------------- API: TESTIMONIALS -------------------

app.get('/api/testimonials', async (req, res) => {
    try {
        const { public } = req.query;
        let query = 'SELECT * FROM testimonials ORDER BY id DESC';
        if(public === "true") {
            query = "SELECT * FROM testimonials WHERE \"isVisible\" = 1 ORDER BY id DESC";
        }
        
        const result = await pool.query(query);
        res.json({ "message": "success", "data": result.rows });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.get('/api/testimonials/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM testimonials WHERE id = $1', [req.params.id]);
        res.json({ "message": "success", "data": result.rows[0] });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.post('/api/testimonials', authenticateAdmin, async (req, res) => {
    try {
        const { clientName, review, rating, isVisible } = req.body;
        const viz = (isVisible !== undefined && isVisible !== 'false') ? 1 : 0;
        
        const result = await pool.query(
            'INSERT INTO testimonials ("clientName", review, rating, "isVisible") VALUES ($1, $2, $3, $4) RETURNING id',
            [clientName, review, rating, viz]
        );
        res.json({ "message": "success", "data": { id: result.rows[0].id } });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.put('/api/testimonials/:id', authenticateAdmin, async (req, res) => {
    try {
        const { clientName, review, rating, isVisible } = req.body;
        await pool.query(
            'UPDATE testimonials SET "clientName" = $1, review = $2, rating = $3, "isVisible" = $4 WHERE id = $5',
            [clientName, review, rating || 5, isVisible, req.params.id]
        );
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

app.delete('/api/testimonials/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM testimonials WHERE id = $1', [req.params.id]);
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// ------------------- API: CONTACT FORM (NODEMAILER) -------------------

app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    try {
        let testAccount = await nodemailer.createTestAccount();

        const transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });

        let info = await transporter.sendMail({
            from: `"${name}" <${email}>`, 
            to: "admin@unityconstruction.com", 
            subject: `Contact Form: ${subject}`, 
            text: `You received a new inquiry from your website!\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        });
        
        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

        res.json({"message": "success", previewUrl: nodemailer.getTestMessageUrl(info)});
    } catch (e) {
        console.error(e);
        res.status(500).json({"error": 'Failed to send email'});
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

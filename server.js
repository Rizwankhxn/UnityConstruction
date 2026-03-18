const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Expose uploads folder

// Multer Disk Storage config for Image Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Create unique filenames
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// Setup SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Ensure projects table has imageUrl
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL,
            client TEXT,
            budget REAL,
            startDate TEXT,
            imageUrl TEXT
        )`, (err) => {
            if(!err) {
                // Safely attempt to add a new column if this was an existing db
                db.run('ALTER TABLE projects ADD COLUMN imageUrl TEXT', (e) => { /* Ignore duplicate err */ });
                
                // Seed Projects if empty
                db.get('SELECT COUNT(*) as count FROM projects', (err, row) => {
                    if (row && row.count === 0) {
                        db.run(`INSERT INTO projects (name, type, status, client, budget, startDate, imageUrl) VALUES ('Luxury Villa', 'Residential', 'Completed', 'Mr. Smith', 1500000, '2024-01-10', 'assets/images/project1.png')`);
                        db.run(`INSERT INTO projects (name, type, status, client, budget, startDate, imageUrl) VALUES ('Tech Park Office', 'Commercial', 'Ongoing', 'Tech Corp', 5200000, '2024-04-20', 'assets/images/project2.png')`);
                        db.run(`INSERT INTO projects (name, type, status, client, budget, startDate, imageUrl) VALUES ('City Plaza Renovation', 'Remodeling', 'Completed', 'City Council', 850000, '2024-08-05', 'assets/images/project3.png')`);
                    }
                });
            }
        });

        // Create Testimonials table
        db.run(`CREATE TABLE IF NOT EXISTS testimonials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clientName TEXT NOT NULL,
            review TEXT NOT NULL,
            rating INTEGER DEFAULT 5,
            isVisible INTEGER DEFAULT 1
        )`, () => {
            // Seed Testimonials if empty
            db.get('SELECT COUNT(*) as count FROM testimonials', (err, row) => {
                if (row && row.count === 0) {
                    db.run(`INSERT INTO testimonials (clientName, review, rating, isVisible) VALUES ('Sarah Jenkins', 'UnityConstruction built my dream home beautifully. The team was highly professional and paid attention to every detail!', 5, 1)`);
                    db.run(`INSERT INTO testimonials (clientName, review, rating, isVisible) VALUES ('Michael Carter', 'Excellent communication and top-notch craftsmanship. Their project management is the best in the business.', 5, 1)`);
                    db.run(`INSERT INTO testimonials (clientName, review, rating, isVisible) VALUES ('Elena Rodriguez', 'They finished my store remodeling ahead of schedule and precisely within budget. Highly recommended!', 5, 1)`);
                }
            });
        });
    }
});

// ------------------- API: PROJECTS -------------------

app.get('/api/projects', (req, res) => {
    db.all('SELECT * FROM projects ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});

app.get('/api/dashboard/stats', (req, res) => {
    const statsQuery = `
        SELECT 
            COUNT(*) as totalProjects,
            SUM(CASE WHEN status = 'Ongoing' THEN 1 ELSE 0 END) as ongoingProjects,
            SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completedProjects
        FROM projects
    `;
    db.get(statsQuery, [], (err, row) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({
            "message": "success",
            "data": {
                totalProjects: row.totalProjects || 0,
                ongoingProjects: row.ongoingProjects || 0,
                completedProjects: row.completedProjects || 0
            }
        });
    });
});

app.get('/api/projects/:id', (req, res) => {
    db.get('SELECT * FROM projects WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success", "data": row });
    });
});

// Create Project (with image)
app.post('/api/projects', upload.single('image'), (req, res) => {
    const { name, type, status, client, budget, startDate } = req.body;
    let imageUrl = req.file ? '/uploads/' + req.file.filename : null;
    
    db.run(
        'INSERT INTO projects (name, type, status, client, budget, startDate, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, type, status, client, budget, startDate, imageUrl],
        function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ "message": "success", "data": { id: this.lastID } });
        }
    );
});

// Update Project (optionally replace image)
app.put('/api/projects/:id', upload.single('image'), (req, res) => {
    const { name, type, status, client, budget, startDate } = req.body;
    let imageUrl = req.file ? '/uploads/' + req.file.filename : req.body.existingImage;
    
    db.run(
        'UPDATE projects SET name = ?, type = ?, status = ?, client = ?, budget = ?, startDate = ?, imageUrl = ? WHERE id = ?',
        [name, type, status, client, budget, startDate, imageUrl, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ "message": "success" });
        }
    );
});

app.delete('/api/projects/:id', (req, res) => {
    db.run('DELETE FROM projects WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success" });
    });
});

// ------------------- API: TESTIMONIALS -------------------

app.get('/api/testimonials', (req, res) => {
    const { public } = req.query;
    let query = 'SELECT * FROM testimonials ORDER BY id DESC';
    if(public === "true") query = "SELECT * FROM testimonials WHERE isVisible IN (1, '1', 'true') ORDER BY id DESC";
    
    db.all(query, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success", "data": rows });
    });
});

app.get('/api/testimonials/:id', (req, res) => {
    db.get('SELECT * FROM testimonials WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success", "data": row });
    });
});

app.post('/api/testimonials', (req, res) => {
    const { clientName, review, rating, isVisible } = req.body;
    const viz = isVisible !== undefined ? isVisible : 1;
    db.run(
        'INSERT INTO testimonials (clientName, review, rating, isVisible) VALUES (?, ?, ?, ?)',
        [clientName, review, rating, viz],
        function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ "message": "success", "data": { id: this.lastID } });
        }
    );
});

app.put('/api/testimonials/:id', (req, res) => {
    const { clientName, review, rating, isVisible } = req.body;
    db.run(
        'UPDATE testimonials SET clientName = ?, review = ?, rating = ?, isVisible = ? WHERE id = ?',
        [clientName, review, rating || 5, isVisible, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ "message": "success" });
        }
    );
});

app.delete('/api/testimonials/:id', (req, res) => {
    db.run('DELETE FROM testimonials WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success" });
    });
});

// ------------------- API: CONTACT FORM (NODEMAILER) -------------------

app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Use a test account from Ethereal Email for demonstration, 
    // since we do not have real credentials.
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

    try {
        let info = await transporter.sendMail({
            from: `"${name}" <${email}>`, 
            to: "admin@unityconstruction.com", 
            subject: `Contact Form: ${subject}`, 
            text: `You received a new inquiry from your website!\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        });
        
        console.log("Message sent: %s", info.messageId);
        // Ethereal provides a preview URL perfectly!
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

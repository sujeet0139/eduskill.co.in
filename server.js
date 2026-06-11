const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();
const { requireAdmin } = require('./middleware/authMiddleware');
const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // Secure HTTP headers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting: Max 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', apiLimiter);

// Create uploads folder for local-disk storage. On serverless hosts the app
// filesystem is read-only/ephemeral (uploads go to Cloudinary instead), so this
// is best-effort and must never crash startup.
const uploadDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  console.warn('Could not create local uploads dir (expected on serverless):', e.message);
}

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME sniffing
  }
}));

app.get('/health', (req, res) => {
  res.json({ status: 'Server running', time: new Date() });
});

const studentsRouter = require('./routes/students');
app.use('/api/students', studentsRouter);

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const paymentsRouter = require('./routes/payments');
app.use('/api/payments', paymentsRouter);

const materialsRouter = require('./routes/materials');
app.use('/api/materials', materialsRouter);

const programsRouter = require('./routes/programs');
app.use('/api/programs', programsRouter);

const coursesRouter = require('./routes/courses');
app.use('/api/courses', coursesRouter);

// PROTECTED STUDENT ROUTES
const studentDashboardRouter = require('./routes/student-dashboard');
app.use('/api/student-dashboard', studentDashboardRouter);

// PROTECTED ADMIN ROUTES (Require valid JWT Token)
const assignmentsRouter = require('./routes/assignments');
app.use('/api/assignments', requireAdmin, assignmentsRouter);

const certificatesRouter = require('./routes/certificates');
app.use('/api/certificates', requireAdmin, certificatesRouter);

const announcementsRouter = require('./routes/announcements');
app.use('/api/announcements', requireAdmin, announcementsRouter);

const reportsRouter = require('./routes/reports');
app.use('/api/reports', requireAdmin, reportsRouter);

const settingsRouter = require('./routes/settings');
app.use('/api/settings', requireAdmin, settingsRouter);

const collegesRouter = require('./routes/colleges');
app.use('/api/colleges', requireAdmin, collegesRouter);

const adminsRouter = require('./routes/admins');
app.use('/api/admins', requireAdmin, adminsRouter);

const PORT = process.env.PORT || 5000;

// Only start a listener when run directly (local/VPS). On Vercel the platform
// imports this module and invokes `app` as a serverless handler, so we must NOT
// call listen() there.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Database: ${process.env.DB_NAME}`);
  });
}

module.exports = app;
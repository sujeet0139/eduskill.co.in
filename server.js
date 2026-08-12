const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();
const { requireAdmin } = require('./middleware/authMiddleware');
const pool = require('./config/db');
const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // Secure HTTP headers

// CORS must allow credentials so the httpOnly session cookie flows between the
// frontend (eduskill.co.in) and this API (api.eduskill.co.in). With credentials
// enabled the origin can no longer be "*", so we echo only known origins.
// Add extra origins via FRONTEND_URL (comma-separated) — e.g. Vercel previews.
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : [])
  .map((s) => s.trim())
  .filter(Boolean)
  .concat([
    'https://eduskill.co.in',
    'https://www.eduskill.co.in',
    'http://localhost:3000',
    'http://localhost:3003',
  ]);

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser clients (curl, server-to-server) that send no Origin.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting: Max 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', apiLimiter);

// Stricter limit on login attempts specifically, to slow down brute-forcing a
// password — the generic 200-req/15min apiLimiter above is far too loose for
// that on its own (dev-prompt Priority 0 item #10).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/api/auth/login', '/api/auth/admin/login', '/api/auth/teacher/login'], loginLimiter);

// Create uploads folder for local-disk storage. On serverless hosts the app
// filesystem is read-only/ephemeral (uploads go to Cloudinary instead), so this
// is best-effort and must never crash startup.
// Use the SAME directory the upload writer uses (config/storage.js), so files
// are always served back from where they were saved regardless of pm2's cwd.
const { LOCAL_UPLOAD_DIR } = require('./config/storage');
try {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.warn('Could not create local uploads dir (expected on serverless):', e.message);
}

// Serve uploaded images (only used when storing on local disk; Cloudinary URLs
// are absolute and bypass this route entirely).
app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, {
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME sniffing
  }
}));

app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    res.json({ status: 'Server running', database: 'Connected', time: new Date() });
  } catch (error) {
    res.status(500).json({ status: 'Server running', database: 'Disconnected', error: error.message, time: new Date() });
  }
});

const studentsRouter = require('./routes/students');
app.use('/api/students', studentsRouter);

const verifyRouter = require('./routes/verify');
app.use('/api/verify', verifyRouter);

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const paymentsRouter = require('./routes/payments');
app.use('/api/payments', paymentsRouter);

const materialsRouter = require('./routes/materials');
app.use('/api/materials', materialsRouter);

const publicApiRouter = require('./routes/public-api');
app.use('/api/public', publicApiRouter);

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

const certificateTemplatesRouter = require('./routes/certificate-templates');
app.use('/api/certificate-templates', requireAdmin, certificateTemplatesRouter);

const announcementsRouter = require('./routes/announcements');
app.use('/api/announcements', requireAdmin, announcementsRouter);

const reportsRouter = require('./routes/reports');
app.use('/api/reports', requireAdmin, reportsRouter);

const settingsRouter = require('./routes/settings');
app.use('/api/settings', requireAdmin, settingsRouter);

const formSettingsRouter = require('./routes/form-settings');
app.use('/api/form-settings', requireAdmin, formSettingsRouter);

const collegesRouter = require('./routes/colleges');
app.use('/api/colleges', requireAdmin, collegesRouter);

const adminsRouter = require('./routes/admins');
app.use('/api/admins', requireAdmin, adminsRouter);

const districtsRouter = require('./routes/districts');
app.use('/api/districts', requireAdmin, districtsRouter);

const departmentsRouter = require('./routes/departments');
app.use('/api/departments', requireAdmin, departmentsRouter);

const facultyRouter = require('./routes/faculty');
app.use('/api/faculty', requireAdmin, facultyRouter);

const liveClassesRouter = require('./routes/live-classes');
app.use('/api/live-classes', requireAdmin, liveClassesRouter);

const examsRouter = require('./routes/exams');
app.use('/api/exams', requireAdmin, examsRouter);

const batchesRouter = require('./routes/batches');
app.use('/api/batches', requireAdmin, batchesRouter);

const heroSlidesRouter = require('./routes/hero-slides');
app.use('/api/hero-slides', requireAdmin, heroSlidesRouter);

const teachersRouter = require('./routes/teachers');
app.use('/api/teachers', teachersRouter); // Middleware is now handled inside teachers.js

const communicationsRouter = require('./routes/communications');
app.use('/api/communications', requireAdmin, communicationsRouter);

// Teacher portal (auth handled inside via requireTeacher).
const teacherPortalRouter = require('./routes/teacher-portal');
app.use('/api/teacher-portal', teacherPortalRouter);

// Start the notification scheduler
const notificationScheduler = require('./scripts/notification-scheduler');
notificationScheduler.start();

const PORT = process.env.PORT || 5000;

// Only start a listener when run directly (local/VPS). On Vercel the platform
// imports this module and invokes `app` as a serverless handler, so we must NOT
// call listen() there.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Database: ${process.env.DB_NAME}`);
    console.log('✓ Notification scheduler is active.');
  });
}

module.exports = app;
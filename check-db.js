const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkDatabase() {
  console.log('🔄 Attempting to connect to MySQL...');
  
  try {
    const useSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'eduskill',
      password: process.env.DB_PASSWORD,
      ssl: useSSL ? { rejectUnauthorized: true } : undefined,
      multipleStatements: true
    });

    console.log('✅ MYSQL CONNECTION SUCCESSFUL!');

    const dbName = process.env.DB_NAME || 'eduskill';
    // Some managed providers pre-create the database and forbid CREATE DATABASE,
    // so treat that step as best-effort and rely on USE to select it.
    console.log(`🔄 Ensuring database '${dbName}' exists...`);
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    } catch (e) {
      console.warn(`⚠️  Could not create database (may already exist or be managed): ${e.message}`);
    }
    await connection.query(`USE \`${dbName}\``);
    
    console.log('🔄 Creating tables if they do not exist...');
    
    // 0. DISTRICTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS districts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(20) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1. COLLEGES TABLE (Updated with Master Data Fields)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS colleges (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL UNIQUE,
        college_code VARCHAR(50) UNIQUE,
        district_id INT,
        state VARCHAR(50) DEFAULT 'Bihar',
        address TEXT,
        contact_no VARCHAR(50),
        principal_details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Helper to safely add columns/constraints if they don't exist
    const columnExists = async (table, column) => {
      const [rows] = await connection.query(`
        SELECT * FROM information_schema.columns 
        WHERE table_schema = ? AND table_name = ? AND column_name = ?
      `, [dbName, table, column]);
      return rows.length > 0;
    };

    const runAlterIfMissing = async (table, column, alterQuery) => {
      if (await columnExists(table, column)) return;
      try {
        console.log(`  -> Applying schema change: ${alterQuery}`);
        await connection.query(alterQuery);
      } catch (e) {
        console.warn(`⚠️  Could not run alter query for ${table}.${column}: ${e.message}`);
      }
    };

    // Safely add new columns to an existing colleges table if they don't already exist
    // This pattern is safer than try/catch(e){}
    await runAlterIfMissing('colleges', 'college_code', "ALTER TABLE colleges ADD COLUMN college_code VARCHAR(50) UNIQUE");
    await runAlterIfMissing('colleges', 'district_id', "ALTER TABLE colleges ADD COLUMN district_id INT");
    await runAlterIfMissing('colleges', 'state', "ALTER TABLE colleges ADD COLUMN state VARCHAR(50) DEFAULT 'Bihar'");
    await runAlterIfMissing('colleges', 'address', "ALTER TABLE colleges ADD COLUMN address TEXT");
    await runAlterIfMissing('colleges', 'contact_no', "ALTER TABLE colleges ADD COLUMN contact_no VARCHAR(50)");
    await runAlterIfMissing('colleges', 'principal_details', "ALTER TABLE colleges ADD COLUMN principal_details TEXT");
    // Note: Checking for foreign keys is more complex, so the original try/catch is acceptable here for simplicity.
    try { await connection.query("ALTER TABLE colleges ADD CONSTRAINT fk_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL"); } catch(e){}

    // Item #23 -- college form improvements.
    // `districts` had no `state` column at all, so the college form's State
    // field and District dropdown were two independent, uncoordinated inputs
    // -- nothing was actually cascading. DEFAULT 'Bihar' backfills every
    // existing district automatically (accurate today; districts added for
    // a different state going forward just need this set explicitly).
    await runAlterIfMissing('districts', 'state', "ALTER TABLE districts ADD COLUMN state VARCHAR(50) NOT NULL DEFAULT 'Bihar'");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS universities (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL UNIQUE
      )
    `);
    await connection.query(`INSERT IGNORE INTO universities (name) VALUES ('Lalit Narayan Mithila University (LNMU)')`);

    await runAlterIfMissing('colleges', 'university_id', "ALTER TABLE colleges ADD COLUMN university_id INT");
    await runAlterIfMissing('colleges', 'website', "ALTER TABLE colleges ADD COLUMN website VARCHAR(255)");
    await runAlterIfMissing('colleges', 'logo_url', "ALTER TABLE colleges ADD COLUMN logo_url VARCHAR(500)");
    // Structured replacements for the old free-text `principal_details` blob
    // -- kept alongside it (not replacing) so no existing data is lost.
    await runAlterIfMissing('colleges', 'principal_name', "ALTER TABLE colleges ADD COLUMN principal_name VARCHAR(150)");
    await runAlterIfMissing('colleges', 'principal_phone', "ALTER TABLE colleges ADD COLUMN principal_phone VARCHAR(20)");
    try { await connection.query("ALTER TABLE colleges ADD CONSTRAINT fk_college_university FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL"); } catch (e) {}

    // HOD Details -- "support multiple" per the dev-prompt, so a table, not
    // a column.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS college_hods (
        id INT PRIMARY KEY AUTO_INCREMENT,
        college_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        department VARCHAR(150),
        phone VARCHAR(20),
        email VARCHAR(150),
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
      )
    `);

    // 1A. DEPARTMENTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        college_id INT NOT NULL,
        semester_count INT DEFAULT 6,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
      )
    `);

    // 1B. FACULTY/MENTORS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS faculty (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(50),
        expertise VARCHAR(200),
        college_id INT,
        hourly_rate DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL
      )
    `);

    // 2. STUDENTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT PRIMARY KEY AUTO_INCREMENT,
        reference_no VARCHAR(50) UNIQUE NOT NULL,
        enrollment_id VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        phone VARCHAR(255) NOT NULL,
        aadhar VARCHAR(255),
        pan VARCHAR(255),
        roll_number VARCHAR(50),
        current_year INT DEFAULT 1,
        wallet_balance DECIMAL(10,2) DEFAULT 0.00,
        college_id INT NOT NULL,
        department_id INT,
        department VARCHAR(150),
        father_name VARCHAR(100),
        mother_name VARCHAR(100),
        parent_phone VARCHAR(50),
        address_permanent TEXT,
        reset_token VARCHAR(255),
        reset_token_expiry DATETIME,
        status ENUM('registered', 'verified', 'completed') DEFAULT 'registered',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_reference (reference_no)
      )
    `);

    // Safely alter existing students table if updating
    await runAlterIfMissing('students', 'enrollment_id', "ALTER TABLE students ADD COLUMN enrollment_id VARCHAR(20) UNIQUE AFTER reference_no");
    await runAlterIfMissing('students', 'password_hash', "ALTER TABLE students ADD COLUMN password_hash VARCHAR(255) AFTER email");
    await runAlterIfMissing('students', 'roll_number', "ALTER TABLE students ADD COLUMN roll_number VARCHAR(50)");
    await runAlterIfMissing('students', 'current_year', "ALTER TABLE students ADD COLUMN current_year INT DEFAULT 1");
    await runAlterIfMissing('students', 'wallet_balance', "ALTER TABLE students ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0.00");
    await runAlterIfMissing('students', 'department_id', "ALTER TABLE students ADD COLUMN department_id INT");
    await runAlterIfMissing('students', 'department', "ALTER TABLE students ADD COLUMN department VARCHAR(150) AFTER department_id");
    await runAlterIfMissing('students', 'aadhar', "ALTER TABLE students ADD COLUMN aadhar VARCHAR(255) AFTER phone");
    await runAlterIfMissing('students', 'pan', "ALTER TABLE students ADD COLUMN pan VARCHAR(255) AFTER aadhar");
    await runAlterIfMissing('students', 'father_name', "ALTER TABLE students ADD COLUMN father_name VARCHAR(100) AFTER department_id");
    await runAlterIfMissing('students', 'mother_name', "ALTER TABLE students ADD COLUMN mother_name VARCHAR(100) AFTER father_name");
    await runAlterIfMissing('students', 'parent_phone', "ALTER TABLE students ADD COLUMN parent_phone VARCHAR(50) AFTER mother_name");
    await runAlterIfMissing('students', 'address_permanent', "ALTER TABLE students ADD COLUMN address_permanent TEXT AFTER parent_phone");
    await runAlterIfMissing('students', 'reset_token', "ALTER TABLE students ADD COLUMN reset_token VARCHAR(255) AFTER address_permanent");
    await runAlterIfMissing('students', 'reset_token_expiry', "ALTER TABLE students ADD COLUMN reset_token_expiry DATETIME AFTER reset_token");
    try { await connection.query("ALTER TABLE students ADD CONSTRAINT fk_student_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE"); } catch(e){}

    // Expanded student master record (dev-prompt Priority 1 item #12) — all
    // nullable/optional per the dev-prompt's own instruction: new fields must
    // never become a new required-at-signup failure point. Fillable later
    // from the student panel/admin edit screen.
    await runAlterIfMissing('students', 'dob', "ALTER TABLE students ADD COLUMN dob DATE AFTER address_permanent");
    await runAlterIfMissing('students', 'gender', "ALTER TABLE students ADD COLUMN gender ENUM('male', 'female', 'other') AFTER dob");
    await runAlterIfMissing('students', 'blood_group', "ALTER TABLE students ADD COLUMN blood_group VARCHAR(5) AFTER gender");
    await runAlterIfMissing('students', 'emergency_contact_name', "ALTER TABLE students ADD COLUMN emergency_contact_name VARCHAR(100) AFTER blood_group");
    await runAlterIfMissing('students', 'emergency_contact_phone', "ALTER TABLE students ADD COLUMN emergency_contact_phone VARCHAR(20) AFTER emergency_contact_name");
    await runAlterIfMissing('students', 'linkedin_url', "ALTER TABLE students ADD COLUMN linkedin_url VARCHAR(255) AFTER emergency_contact_phone");
    await runAlterIfMissing('students', 'github_url', "ALTER TABLE students ADD COLUMN github_url VARCHAR(255) AFTER linkedin_url");
    await runAlterIfMissing('students', 'employment_status', "ALTER TABLE students ADD COLUMN employment_status VARCHAR(50) AFTER github_url");
    await runAlterIfMissing('students', 'referral_source', "ALTER TABLE students ADD COLUMN referral_source VARCHAR(100) AFTER employment_status");

    // Guest vs Enrolled (item #16) — automatic, flips on confirmed payment.
    // Deliberately a separate column from the existing `status` (identity/
    // verification lifecycle: registered/verified/completed), which was being
    // asked to mean two different things at once.
    await runAlterIfMissing('students', 'enrollment_status', "ALTER TABLE students ADD COLUMN enrollment_status ENUM('guest', 'enrolled') DEFAULT 'guest' AFTER status");
    // Active/Inactive (item #18) — separate MANUAL override, so an Enrolled
    // student on a break can be marked Inactive without losing Enrolled history.
    await runAlterIfMissing('students', 'is_active', "ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER enrollment_status");

    // Program -> Track (Major/Minor) -> Course hierarchy (item #14). Additive
    // only: `track_id` on courses is nullable, and the pre-existing direct
    // `batches.program_id` link is left untouched, so every course/program/
    // batch that already exists keeps working exactly as before, uncategorized.
    // Assigning existing courses to a track/program is an admin classification
    // task (via the Programs admin screen), not something to guess/auto-migrate.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        program_id INT NOT NULL,
        name ENUM('major', 'minor') NOT NULL,
        label VARCHAR(100),
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
        UNIQUE KEY unique_program_track (program_id, name)
      )
    `);
    await runAlterIfMissing('courses', 'track_id', "ALTER TABLE courses ADD COLUMN track_id INT AFTER category");
    try { await connection.query("ALTER TABLE courses ADD CONSTRAINT fk_course_track FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL"); } catch (e) {}

    // Educational background (item #13) — one row per level (10th/12th/degree),
    // optional, fillable post-registration, with an uploaded certificate scan.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_education (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        level ENUM('10th', '12th', 'graduate', 'other') NOT NULL,
        board_university VARCHAR(150),
        stream VARCHAR(100),
        degree_name VARCHAR(150),
        institution VARCHAR(150),
        year_of_passing INT,
        percentage_or_cgpa VARCHAR(20),
        certificate_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    // Mapping history/audit log (item #26) -- every map/demap of a student
    // to a course or program, who did it, and when.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mapping_audit_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        item_type ENUM('course', 'program') NOT NULL,
        item_id INT NOT NULL,
        action ENUM('mapped', 'demapped') NOT NULL,
        admin_id INT,
        admin_email VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Access log for restricted fields (item #12's Aadhaar note: "mark as a
    // restricted field with access logging, not a plain text column"). Every
    // time an admin's full-profile view returns a student's Aadhaar number,
    // a row lands here — see routes/students.js full-profile.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sensitive_field_access_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        accessed_by_admin_id INT,
        accessed_by_email VARCHAR(150),
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. PAYMENTS TABLE (Enhanced)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_for_type ENUM('registration', 'course', 'program', 'exam', 'wallet_topup') NOT NULL,
        payment_for_id INT,
        payment_method ENUM('razorpay', 'wallet', 'bank_transfer', 'emi_parent') DEFAULT 'bank_transfer',
        transaction_id VARCHAR(100),
        status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
        screenshot VARCHAR(255),
        payment_date DATETIME,
        notes TEXT,
        refund_status ENUM('none', 'requested', 'approved', 'rejected') DEFAULT 'none',
        refund_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        INDEX idx_student (student_id),
        INDEX idx_status (status)
      )
    `);

    // Safely add new columns
    try { await connection.query("ALTER TABLE payments DROP FOREIGN KEY payments_ibfk_1"); } catch(e) {} // Drop old FK if it exists
    await runAlterIfMissing('payments', 'payment_for_type', "ALTER TABLE payments ADD COLUMN payment_for_type ENUM('registration', 'course', 'program', 'exam', 'wallet_topup') NOT NULL AFTER amount");
    await runAlterIfMissing('payments', 'payment_for_id', "ALTER TABLE payments ADD COLUMN payment_for_id INT AFTER payment_for_type");
    await runAlterIfMissing('payments', 'payment_method', "ALTER TABLE payments ADD COLUMN payment_method ENUM('razorpay', 'wallet', 'bank_transfer', 'emi_parent') DEFAULT 'bank_transfer' AFTER payment_for_id");
    await runAlterIfMissing('payments', 'notes', "ALTER TABLE payments ADD COLUMN notes TEXT AFTER payment_date");
    await runAlterIfMissing('payments', 'refund_status', "ALTER TABLE payments ADD COLUMN refund_status ENUM('none', 'requested', 'approved', 'rejected') DEFAULT 'none' AFTER notes");
    await runAlterIfMissing('payments', 'refund_amount', "ALTER TABLE payments ADD COLUMN refund_amount DECIMAL(10,2) AFTER refund_status");
    try { await connection.query("ALTER TABLE payments MODIFY COLUMN amount DECIMAL(10,2) NOT NULL"); } catch(e) {} // MODIFY is different
    try { await connection.query("ALTER TABLE payments MODIFY COLUMN status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending'"); } catch(e) {} // MODIFY is different
    try { await connection.query("ALTER TABLE payments ADD CONSTRAINT fk_payment_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE"); } catch(e) {} // Add constraint
    try { await connection.query("ALTER TABLE payments ADD INDEX idx_status (status)"); } catch(e) {} // Add index

    // 4. ADMIN USERS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        role ENUM('admin', 'moderator', 'viewer') DEFAULT 'moderator',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);
    // Staff/admin forgot-password (item #30) -- students already had this,
    // admin_users didn't.
    await runAlterIfMissing('admin_users', 'reset_token', "ALTER TABLE admin_users ADD COLUMN reset_token VARCHAR(255)");
    await runAlterIfMissing('admin_users', 'reset_token_expiry', "ALTER TABLE admin_users ADD COLUMN reset_token_expiry DATETIME");

    // 5. STUDY MATERIALS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS study_materials (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        file_path VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runAlterIfMissing('study_materials', 'category', "ALTER TABLE study_materials ADD COLUMN category VARCHAR(100) AFTER description");
    // Organize materials by course / program / subject (all optional).
    await runAlterIfMissing('study_materials', 'course_id', "ALTER TABLE study_materials ADD COLUMN course_id INT AFTER category");
    await runAlterIfMissing('study_materials', 'program_id', "ALTER TABLE study_materials ADD COLUMN program_id INT AFTER course_id");
    await runAlterIfMissing('study_materials', 'subject', "ALTER TABLE study_materials ADD COLUMN subject VARCHAR(100) AFTER program_id");

    // 6. PROGRAMS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS programs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        duration_weeks INT,
        fee DECIMAL(10,2),
        start_date DATE,
        end_date DATE,
        max_enrollment INT,
        status ENUM('active', 'inactive', 'draft') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. COURSES (LMS) TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        duration_weeks INT,
        price DECIMAL(10,2),
        min_payment DECIMAL(10,2) DEFAULT 0,
        language VARCHAR(50),
        level VARCHAR(50),
        status ENUM('active', 'draft') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runAlterIfMissing('courses', 'min_payment', "ALTER TABLE courses ADD COLUMN min_payment DECIMAL(10,2) DEFAULT 0 AFTER price");
    await runAlterIfMissing('courses', 'content_pdf', "ALTER TABLE courses ADD COLUMN content_pdf VARCHAR(255) AFTER description");
    await runAlterIfMissing('courses', 'subject', "ALTER TABLE courses ADD COLUMN subject VARCHAR(150) AFTER category");
    // Item #25 -- courses had a content_pdf but no thumbnail/banner image at all.
    await runAlterIfMissing('courses', 'image_url', "ALTER TABLE courses ADD COLUMN image_url VARCHAR(500) AFTER content_pdf");
    await runAlterIfMissing('programs', 'min_payment', "ALTER TABLE programs ADD COLUMN min_payment DECIMAL(10,2) DEFAULT 0 AFTER fee");

    // 7A. BATCHES TABLE (For Courses & Programs)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        course_id INT,
        program_id INT,
        mentor_id INT,
        start_date DATE,
        end_date DATE,
        max_students INT DEFAULT 30,
        current_enrolled INT DEFAULT 0,
        status ENUM('open', 'full', 'completed', 'cancelled') DEFAULT 'open',
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
        FOREIGN KEY (mentor_id) REFERENCES faculty(id) ON DELETE SET NULL
      )
    `);

    // Item #27's "view of only their assigned batches" needs a real link
    // from a batch to the teacher who logs into the teacher portal. The
    // pre-existing `mentor_id` points at the separate, login-less `faculty`
    // table (used elsewhere as a lightweight guest-mentor reference) --
    // deliberately left untouched. This is a second, additive assignment.
    await runAlterIfMissing('batches', 'teacher_id', "ALTER TABLE batches ADD COLUMN teacher_id INT AFTER mentor_id");
    try { await connection.query("ALTER TABLE batches ADD CONSTRAINT fk_batch_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL"); } catch (e) {}

    // 8. COURSE MODULES & LESSONS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS course_modules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        course_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        order_no INT DEFAULT 0,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS course_lessons (
        id INT PRIMARY KEY AUTO_INCREMENT,
        module_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        type ENUM('video', 'pdf', 'quiz', 'assignment') DEFAULT 'video',
        video_url VARCHAR(255),
        pdf_url VARCHAR(255),
        duration_minutes INT,
        is_free BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE
      )
    `);

    // 9. ASSIGNMENTS & SUBMISSIONS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        course_id INT,
        description TEXT,
        due_date DATETIME,
        program_id INT,
        max_marks INT,
        submission_type ENUM('file', 'text', 'both') DEFAULT 'both',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        assignment_id INT NOT NULL,
        student_id INT NOT NULL,
        file_url VARCHAR(255),
        text_answer TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        marks INT,
        feedback TEXT,
        status ENUM('pending', 'approved', 'revision', 'rejected') DEFAULT 'pending',
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    // 9b. Assignment targeting: who receives an assignment.
    // audience: all | course | program | batch | selected
    await runAlterIfMissing('assignments', 'audience', "ALTER TABLE assignments ADD COLUMN audience VARCHAR(20) DEFAULT 'all' AFTER program_id");
    await runAlterIfMissing('assignments', 'batch_id', "ALTER TABLE assignments ADD COLUMN batch_id INT AFTER audience");
    await runAlterIfMissing('assignments', 'created_by', "ALTER TABLE assignments ADD COLUMN created_by VARCHAR(100) AFTER submission_type");
    await runAlterIfMissing('assignments', 'created_by_role', "ALTER TABLE assignments ADD COLUMN created_by_role VARCHAR(20) AFTER created_by");
    // Explicit recipient list for audience = 'selected' / single student.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assignment_targets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        assignment_id INT NOT NULL,
        student_id INT NOT NULL,
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY unique_target (assignment_id, student_id)
      )
    `);
    // Ensure one submission row per (assignment, student) so re-submits upsert.
    await runAlterIfMissing('assignment_submissions', 'unique_submission_key', "ALTER TABLE assignment_submissions ADD UNIQUE KEY unique_submission (assignment_id, student_id)");

    // 10. CERTIFICATES
    await connection.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        course_id INT,
        program_id INT,
        certificate_no VARCHAR(100) UNIQUE NOT NULL,
        issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'revoked') DEFAULT 'active',
        final_score_percent DECIMAL(5,2),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
      )
    `);

    // Safely add new columns to certificates table
    await runAlterIfMissing('certificates', 'program_id', "ALTER TABLE certificates ADD COLUMN program_id INT");
    await runAlterIfMissing('certificates', 'final_score_percent', "ALTER TABLE certificates ADD COLUMN final_score_percent DECIMAL(5,2)");
    try { await connection.query("ALTER TABLE certificates ADD CONSTRAINT fk_cert_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL"); } catch(e){}
    try { await connection.query("ALTER TABLE certificates ADD CONSTRAINT fk_cert_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL"); } catch(e){}

    // 10b. CERTIFICATE TEMPLATES — designable, mapped to a course/program (or default).
    // Body supports placeholders: {{name}} {{course}} {{college}} {{date}} {{score}} {{cert_no}}
    await connection.query(`
      CREATE TABLE IF NOT EXISTS certificate_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(150) NOT NULL,
        heading VARCHAR(200) DEFAULT 'Certificate of Completion',
        body TEXT,
        logo_url VARCHAR(255),
        seal_url VARCHAR(255),
        accent_color VARCHAR(20) DEFAULT '#1e3a8a',
        sig1_name VARCHAR(120), sig1_title VARCHAR(120), sig1_image VARCHAR(255),
        sig2_name VARCHAR(120), sig2_title VARCHAR(120), sig2_image VARCHAR(255),
        sig3_name VARCHAR(120), sig3_title VARCHAR(120), sig3_image VARCHAR(255),
        course_id INT,
        program_id INT,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
      )
    `);
    // Link a certificate to the template it was issued with (snapshotted at issue time).
    await runAlterIfMissing('certificates', 'template_id', "ALTER TABLE certificates ADD COLUMN template_id INT");

    // 11. ANNOUNCEMENTS & SETTINGS
    await connection.query(`CREATE TABLE IF NOT EXISTS announcements (id INT PRIMARY KEY AUTO_INCREMENT, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, target_type VARCHAR(50), target_id INT, send_email BOOLEAN DEFAULT FALSE, scheduled_at DATETIME, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    await connection.query(`CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY AUTO_INCREMENT, setting_key VARCHAR(100) UNIQUE NOT NULL, setting_value TEXT)`);

    // 11b. REGISTRATION FAILURES — diagnostic log for failed student
    // registration / add-student submissions (dev-prompt Priority 0 #1).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS registration_failures (
        id INT PRIMARY KEY AUTO_INCREMENT,
        source VARCHAR(50) NOT NULL,
        payload_json TEXT,
        error_message VARCHAR(1000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. LIVE CLASSES
    await connection.query(`
      CREATE TABLE IF NOT EXISTS live_classes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        topic VARCHAR(200),
        mentor_id INT,
        course_id INT,
        college_id INT,
        scheduled_at DATETIME NOT NULL,
        duration_minutes INT DEFAULT 60,
        meet_link VARCHAR(255),
        max_students INT DEFAULT 100,
        attendance_enabled BOOLEAN DEFAULT TRUE,
        status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
        recording_url VARCHAR(255),
        materials_url VARCHAR(255),
        is_24hr_reminder_sent BOOLEAN DEFAULT FALSE,
        is_1hr_reminder_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mentor_id) REFERENCES faculty(id) ON DELETE SET NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL
      )
    `);

    // Safely add new columns if they don't exist
    await runAlterIfMissing('live_classes', 'is_24hr_reminder_sent', "ALTER TABLE live_classes ADD COLUMN is_24hr_reminder_sent BOOLEAN DEFAULT FALSE");
    await runAlterIfMissing('live_classes', 'is_1hr_reminder_sent', "ALTER TABLE live_classes ADD COLUMN is_1hr_reminder_sent BOOLEAN DEFAULT FALSE");
    // Item #27 -- a "session" a teacher marks attendance for needs to be
    // scoped to their specific batch (existing course_id is shared by every
    // batch of that course). Nullable/additive: existing rows just aren't
    // batch-scoped, same as before.
    await runAlterIfMissing('live_classes', 'batch_id', "ALTER TABLE live_classes ADD COLUMN batch_id INT AFTER course_id");
    try { await connection.query("ALTER TABLE live_classes ADD CONSTRAINT fk_liveclass_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL"); } catch (e) {}

    // 13. CLASS ATTENDANCE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS class_attendance (
        id INT PRIMARY KEY AUTO_INCREMENT,
        class_id INT NOT NULL,
        student_id INT NOT NULL,
        status ENUM('present', 'absent') DEFAULT 'present',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_attendance (class_id, student_id),
        FOREIGN KEY (class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    // 14. STUDENT ENROLLMENTS & LEARNING PATH
    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_courses (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        course_id INT NOT NULL,
        batch_id INT,
        status ENUM('enrolled', 'in_progress', 'completed') DEFAULT 'enrolled',
        progress_percent DECIMAL(5,2) DEFAULT 0.00,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
        UNIQUE KEY unique_student_course (student_id, course_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_programs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        program_id INT NOT NULL,
        batch_id INT,
        status ENUM('enrolled', 'in_progress', 'completed', 'dropped') DEFAULT 'enrolled',
        weeks_completed INT DEFAULT 0,
        mentor_feedback TEXT,
        expected_completion_date DATE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
        UNIQUE KEY unique_student_program (student_id, program_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_lesson_progress (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        lesson_id INT NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE,
        UNIQUE KEY unique_student_lesson (student_id, lesson_id)
      )
    `);

    // 15. CLASS FEEDBACK
    await connection.query(`
      CREATE TABLE IF NOT EXISTS class_feedback (
        id INT PRIMARY KEY AUTO_INCREMENT,
        class_id INT NOT NULL,
        student_id INT NOT NULL,
        rating INT CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY unique_feedback (class_id, student_id)
      )
    `);

    // 16. EXAMS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        type ENUM('pre_assessment', 'mid_term', 'final_exam', 'mock_exam', 'quiz') DEFAULT 'quiz',
        course_id INT,
        program_id INT,
        passing_score INT DEFAULT 50,
        duration_minutes INT DEFAULT 60,
        scheduled_at DATETIME,
        fee DECIMAL(10,2) DEFAULT 0.00,
        has_negative_marking BOOLEAN DEFAULT FALSE,
        shuffle_questions BOOLEAN DEFAULT FALSE,
        weightage_percent INT DEFAULT 100,
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
      )
    `);

    // 17. EXAM QUESTIONS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS exam_questions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        exam_id INT NOT NULL,
        question_text TEXT NOT NULL,
        type ENUM('mcq', 'short_answer', 'essay') DEFAULT 'mcq',
        options JSON,
        correct_answer VARCHAR(255),
        marks INT DEFAULT 1,
        negative_marks INT DEFAULT 0,
        order_no INT DEFAULT 0,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // 18. STUDENT EXAM ATTEMPTS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_exam_attempts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        exam_id INT NOT NULL,
        started_at DATETIME,
        completed_at DATETIME,
        score INT,
        percentage DECIMAL(5,2),
        grade VARCHAR(10),
        status ENUM('not_started', 'in_progress', 'completed', 'graded') DEFAULT 'not_started',
        is_passed BOOLEAN,
        payment_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        UNIQUE KEY unique_attempt (student_id, exam_id)
      )
    `);

    // 19. EMI INSTALLMENTS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS emi_installments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        parent_payment_id INT NOT NULL,
        student_id INT NOT NULL,
        installment_no INT NOT NULL,
        amount_due DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
        paid_date DATETIME,
        payment_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_payment_id) REFERENCES payments(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        UNIQUE KEY unique_installment (parent_payment_id, installment_no)
      )
    `);

    // 20. HERO SLIDES (for homepage carousel)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS hero_slides (
        id INT PRIMARY KEY AUTO_INCREMENT,
        image_url VARCHAR(255) NOT NULL,
        alt_text VARCHAR(255),
        title VARCHAR(255),
        subtitle TEXT,
        cta_text VARCHAR(100),
        cta_link VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        order_no INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 20b. COMMUNICATION LOGS (email / WhatsApp broadcast history)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS communication_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        channel ENUM('email', 'whatsapp') NOT NULL,
        subject VARCHAR(255),
        audience TEXT,
        recipient_count INT DEFAULT 0,
        sent_count INT DEFAULT 0,
        sent_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 21. TEACHERS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        teacher_id VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        subject VARCHAR(100),
        expertise TEXT,
        qualification VARCHAR(200),
        experience VARCHAR(50),
        mobile VARCHAR(20) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        gender VARCHAR(20),
        dob DATE,
        address TEXT,
        available_time VARCHAR(100),
        profile_photo VARCHAR(255),
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        joining_date DATE,
        class_timing VARCHAR(100),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_teacher_id (teacher_id),
        INDEX idx_status (status)
      )`);
    // Teacher login credential (set by admin). Teachers log in at /teacher.
    await runAlterIfMissing('teachers', 'password_hash', "ALTER TABLE teachers ADD COLUMN password_hash VARCHAR(255) AFTER email");
    // Self-authored profile bio (item #27) -- distinct from `remarks`, which
    // is an admin-only internal note.
    await runAlterIfMissing('teachers', 'bio', "ALTER TABLE teachers ADD COLUMN bio TEXT AFTER expertise");

    // 22. STUDENT DOCUMENTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        file_url VARCHAR(255) NOT NULL,
        file_name VARCHAR(255),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending_verification', 'verified', 'rejected') DEFAULT 'pending_verification',
        notes TEXT,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY unique_doc (student_id, document_type)
      )
    `);

    // 23. REGISTRATION FORM FIELDS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS registration_fields (
        id INT PRIMARY KEY AUTO_INCREMENT,
        field_name VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        type ENUM('text', 'email', 'tel', 'password', 'number', 'select') DEFAULT 'text',
        is_standard BOOLEAN DEFAULT TRUE,
        is_enabled BOOLEAN DEFAULT TRUE,
        is_mandatory BOOLEAN DEFAULT FALSE,
        options JSON,
        validation_regex VARCHAR(255),
        order_no INT DEFAULT 0
      )
    `);

    // Seed the standard fields into the new table if they don't exist
    await connection.query(`
      INSERT IGNORE INTO registration_fields (field_name, label, type, is_mandatory, is_enabled, order_no) VALUES
      ('name', 'Full Name', 'text', TRUE, TRUE, 10),
      ('email', 'Email Address', 'email', TRUE, TRUE, 20),
      ('password', 'Password', 'password', TRUE, TRUE, 30),
      ('phone', 'Mobile Number', 'tel', TRUE, TRUE, 40),
      ('collegeId', 'College', 'select', TRUE, TRUE, 50),
      ('department', 'Department', 'text', FALSE, TRUE, 60),
      ('aadhar', 'Aadhaar Number', 'text', FALSE, TRUE, 70),
      ('pan', 'PAN Number', 'text', FALSE, TRUE, 80),
      ('roll_number', 'Class Roll Number', 'text', FALSE, TRUE, 90),
      ('current_year', 'Current Year of Study', 'number', FALSE, TRUE, 100)
    `);

    // 22A. STUDENT CUSTOM FIELDS (to store data for custom registration fields)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS student_custom_fields (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        field_id INT NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (field_id) REFERENCES registration_fields(id) ON DELETE CASCADE,
        UNIQUE KEY unique_student_field (student_id, field_id)
      )
    `);

    // CAMPAIGN LINKS (eduskill-campaign-admin-prompt.md) -- one shareable
    // landing/registration flow tied to one event/batch. `slug` is the URL
    // identity and, per the spec, must never change once created (content
    // is mutable, the link is not) -- there's no UPDATE path for it below.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT PRIMARY KEY AUTO_INCREMENT,
        slug VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        college_id INT,
        program_id INT,
        course_id INT,
        batch_id INT,
        hero_tag VARCHAR(100),
        headline VARCHAR(255),
        subheading TEXT,
        feedback_enabled BOOLEAN DEFAULT TRUE,
        counselor_toggle_enabled BOOLEAN DEFAULT TRUE,
        confirmation_template TEXT,
        group_link VARCHAR(255),
        starts_at DATETIME,
        ends_at DATETIME,
        status ENUM('active', 'paused') DEFAULT 'active',
        view_count INT DEFAULT 0,
        registration_starts_count INT DEFAULT 0,
        created_by_admin_id INT,
        created_by_email VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
        FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
      )
    `);

    // Self-hosted short link -> campaign slug (section 2's "shortened
    // version of the link"). Deliberately its own table rather than a
    // column, so a campaign's short code can be regenerated without
    // touching the campaign row.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_short_links (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(20) NOT NULL UNIQUE,
        campaign_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);

    // Benefit cards -- addable/removable/reorderable, not a fixed count.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_benefits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        icon VARCHAR(20),
        title VARCHAR(150) NOT NULL,
        description TEXT,
        order_no INT DEFAULT 0,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);

    // "Interest" chips for the feedback step -- editable per campaign since
    // an AI/ML session and a Web Dev session shouldn't share defaults.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_interests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        label VARCHAR(100) NOT NULL,
        order_no INT DEFAULT 0,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);

    // One row per completed registration through a campaign link. Deliberately
    // NOT a parallel student record -- student_id points at the same
    // `students` table every other registration path uses (main dev prompt's
    // "beyond v1" note: campaign data must not become a disconnected silo).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_registrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        student_id INT NOT NULL,
        feedback_rating INT,
        selected_interests JSON,
        counselor_opt_in BOOLEAN DEFAULT FALSE,
        contacted BOOLEAN DEFAULT FALSE,
        feedback_submitted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY unique_campaign_student (campaign_id, student_id)
      )
    `);

    console.log('🔄 Inserting default colleges...');
    await connection.query(`
      INSERT IGNORE INTO colleges (id, name, district_id) VALUES
      (1, 'JANKIDEVI GAURI SHANKAR SARAF DEGREE COLLEGE', 1),
      (2, 'MARWARI COLLEGE', 1),
      (3, 'SATYA NARAYAN MEHARALI RAMANAND CHARAN KARPURI COLLEGE', 3),
      (4, 'JHUMAK MAHASETH DHARMAPRIYA LAL MAHILA COLLEGE', 2),
      (5, 'VISHWESHWAR SINGH JANTA COLLEGE', 1),
      (6, 'KALIDAS VIDYAPATI SCIENCE COLLEGE', 1),
      (7, 'CHETHRU MAHTO JANTA COLLEGE', 1),
      (8, 'JANTA KOSHI MAHAVIDYALAYA', 2)
    `);

    console.log('✅ ALL TABLES CREATED AND DATA SEEDED SUCCESSFULLY!');
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ DATABASE SETUP FAILED!');
    console.error('Error Details:', error.message || error);
    console.error('\nPlease check your .env file credentials and ensure the MySQL server is running.');
    process.exit(1);
  }
}

checkDatabase();
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
    // Note: Checking for foreign keys is more complex, so the original try/catch is acceptable here for simplicity.
    try { await connection.query("ALTER TABLE colleges ADD CONSTRAINT fk_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL"); } catch(e){}

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
    await runAlterIfMissing('students', 'father_name', "ALTER TABLE students ADD COLUMN father_name VARCHAR(100) AFTER department_id");
    await runAlterIfMissing('students', 'mother_name', "ALTER TABLE students ADD COLUMN mother_name VARCHAR(100) AFTER father_name");
    await runAlterIfMissing('students', 'parent_phone', "ALTER TABLE students ADD COLUMN parent_phone VARCHAR(50) AFTER mother_name");
    await runAlterIfMissing('students', 'address_permanent', "ALTER TABLE students ADD COLUMN address_permanent TEXT AFTER parent_phone");
    await runAlterIfMissing('students', 'reset_token', "ALTER TABLE students ADD COLUMN reset_token VARCHAR(255) AFTER address_permanent");
    await runAlterIfMissing('students', 'reset_token_expiry', "ALTER TABLE students ADD COLUMN reset_token_expiry DATETIME AFTER reset_token");
    try { await connection.query("ALTER TABLE students ADD CONSTRAINT fk_student_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE"); } catch(e){}

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

    // 11. ANNOUNCEMENTS & SETTINGS
    await connection.query(`CREATE TABLE IF NOT EXISTS announcements (id INT PRIMARY KEY AUTO_INCREMENT, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, target_type VARCHAR(50), target_id INT, send_email BOOLEAN DEFAULT FALSE, scheduled_at DATETIME, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    await connection.query(`CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY AUTO_INCREMENT, setting_key VARCHAR(100) UNIQUE NOT NULL, setting_value TEXT)`);

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
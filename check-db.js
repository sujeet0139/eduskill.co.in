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
    
    // 1. COLLEGES TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS colleges (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL UNIQUE,
        district VARCHAR(50),
        state VARCHAR(50) DEFAULT 'Bihar',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. STUDENTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT PRIMARY KEY AUTO_INCREMENT,
        reference_no VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(255) NOT NULL,
        aadhar VARCHAR(255),
        pan VARCHAR(255),
        college_id INT NOT NULL,
        department VARCHAR(50),
        status ENUM('registered', 'verified', 'completed') DEFAULT 'registered',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_reference (reference_no)
      )
    `);

    // 3. PAYMENTS TABLE (With Screenshot Column)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        amount DECIMAL(10,2),
        transaction_id VARCHAR(100),
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        screenshot VARCHAR(255),
        payment_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        INDEX idx_student (student_id)
      )
    `);

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
        file_path VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
        language VARCHAR(50),
        level VARCHAR(50),
        status ENUM('active', 'draft') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        certificate_no VARCHAR(100) UNIQUE NOT NULL,
        issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'revoked') DEFAULT 'active',
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    // 11. ANNOUNCEMENTS & SETTINGS
    await connection.query(`CREATE TABLE IF NOT EXISTS announcements (id INT PRIMARY KEY AUTO_INCREMENT, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, target_type VARCHAR(50), target_id INT, send_email BOOLEAN DEFAULT FALSE, scheduled_at DATETIME, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    await connection.query(`CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY AUTO_INCREMENT, setting_key VARCHAR(100) UNIQUE NOT NULL, setting_value TEXT)`);

    console.log('🔄 Inserting default colleges...');
    await connection.query(`
      INSERT IGNORE INTO colleges (id, name, district) VALUES
      (1, 'JANKIDEVI GAURI SHANKAR SARAF DEGREE COLLEGE', 'Darbhanga'),
      (2, 'MARWARI COLLEGE', 'Darbhanga'),
      (3, 'SATYA NARAYAN MEHARALI RAMANAND CHARAN KARPURI COLLEGE', 'Samastipur'),
      (4, 'JHUMAK MAHASETH DHARMAPRIYA LAL MAHILA COLLEGE', 'Madhubani'),
      (5, 'VISHWESHWAR SINGH JANTA COLLEGE', 'Darbhanga'),
      (6, 'KALIDAS VIDYAPATI SCIENCE COLLEGE', 'Darbhanga'),
      (7, 'CHETHRU MAHTO JANTA COLLEGE', 'Darbhanga'),
      (8, 'JANTA KOSHI MAHAVIDYALAYA', 'Madhubani')
    `);

    console.log('✅ ALL TABLES CREATED AND DATA SEEDED SUCCESSFULLY!');
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ DATABASE SETUP FAILED!');
    console.error('Error Details:', error.message);
    console.error('\nPlease check your .env file credentials and ensure the MySQL server is running.');
    process.exit(1);
  }
}

checkDatabase();
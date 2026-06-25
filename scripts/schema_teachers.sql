-- SQL Script to create the teachers table for eduskill.co.in
-- Run this against your MySQL database: mysql -u <user> -p eduskill < scripts/schema_teachers.sql

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

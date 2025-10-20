-- Database schema for Call Center Branch Routing System
-- MySQL/MariaDB

CREATE DATABASE IF NOT EXISTS callcenter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE callcenter;

-- Table for storing branch information
CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(255) NOT NULL COMMENT 'ชื่อสาขาภาษาอังกฤษ',
    branch_name_th VARCHAR(255) NOT NULL COMMENT 'ชื่อสาขาภาษาไทย',
    extension VARCHAR(10) NOT NULL COMMENT 'หมายเลขภายใน',
    phone_number VARCHAR(20) COMMENT 'หมายเลขโทรศัพท์ภายนอก',
    address TEXT COMMENT 'ที่อยู่สาขา',
    manager_name VARCHAR(255) COMMENT 'ชื่อผู้จัดการสาขา',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_extension (extension),
    INDEX idx_branch_name (branch_name),
    INDEX idx_branch_name_th (branch_name_th),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for call logs
CREATE TABLE IF NOT EXISTS call_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caller_id VARCHAR(20) NOT NULL COMMENT 'หมายเลขผู้โทร',
    called_number VARCHAR(20) COMMENT 'หมายเลขที่โทรเข้า',
    requested_branch VARCHAR(255) COMMENT 'สาขาที่ลูกค้าต้องการ',
    recognized_text TEXT COMMENT 'ข้อความที่ระบบจดจำได้',
    routed_to_extension VARCHAR(10) COMMENT 'หมายเลขภายในที่โอนไป',
    call_duration INT DEFAULT 0 COMMENT 'ระยะเวลาการสนทนา (วินาที)',
    call_status ENUM('answered', 'no_answer', 'busy', 'failed') DEFAULT 'answered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_caller_id (caller_id),
    INDEX idx_created_at (created_at),
    INDEX idx_routed_to_extension (routed_to_extension)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for system configuration
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample branch data
INSERT INTO branches (branch_name, branch_name_th, extension, phone_number, address, manager_name) VALUES
('Head Office', 'สำนักงานใหญ่', '100', '02-123-4567', '123 ถนนสุขุมวิท กรุงเทพฯ 10110', 'สมชาย ใจดี'),
('Bangkok Branch', 'สาขากรุงเทพ', '101', '02-234-5678', '456 ถนนรัชดาภิเษก กรุงเทพฯ 10400', 'สมหญิง รักดี'),
('Chiang Mai Branch', 'สาขาเชียงใหม่', '102', '053-123-456', '789 ถนนนิมมานเหมินท์ เชียงใหม่ 50200', 'สมศักดิ์ ใจงาม'),
('Phuket Branch', 'สาขาภูเก็ต', '103', '076-234-567', '321 ถนนป่าตอง ภูเก็ต 83150', 'สมพร ใจใส'),
('Pattaya Branch', 'สาขาพัทยา', '104', '038-345-678', '654 ถนนพัทยา ชลบุรี 20150', 'สมหมาย ใจดี'),
('Khon Kaen Branch', 'สาขาขอนแก่น', '105', '043-456-789', '987 ถนนมิตรภาพ ขอนแก่น 40000', 'สมศรี ใจงาม'),
('Hat Yai Branch', 'สาขาหาดใหญ่', '106', '074-567-890', '147 ถนนนิพัทธ์อุทิศ หาดใหญ่ 90110', 'สมบูรณ์ ใจใส');

-- Insert system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('max_speech_attempts', '3', 'จำนวนครั้งสูงสุดในการรับข้อมูลเสียง'),
('speech_timeout', '10', 'เวลารอรับข้อมูลเสียง (วินาที)'),
('silence_threshold', '3', 'เวลารอความเงียบก่อนจบการบันทึก (วินาที)'),
('tts_voice', 'th-TH-Standard-A', 'เสียงที่ใช้สำหรับ Text-to-Speech'),
('stt_language', 'th-TH', 'ภาษาที่ใช้สำหรับ Speech-to-Text'),
('welcome_message', 'กรุณาพูดสาขาที่ต้องการติดต่อ', 'ข้อความต้อนรับ'),
('confirmation_prefix', 'คุณต้องการติดต่อสาขา', 'ข้อความยืนยันสาขา'),
('confirmation_suffix', 'ใช่หรือไม่', 'ข้อความท้ายการยืนยัน');

-- Create user for the application
CREATE USER IF NOT EXISTS 'callcenter_user'@'localhost' IDENTIFIED BY 'callcenter_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON callcenter.* TO 'callcenter_user'@'localhost';
FLUSH PRIVILEGES;
-- 화상방 강퇴 기록 (당일 재입장 차단용)
-- DB에 테이블이 없으면 이 스크립트를 실행하세요. (MySQL)

CREATE TABLE IF NOT EXISTS meeting_room_kicked_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(16) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    kicked_at DATETIME(6) NOT NULL,
    INDEX idx_room_email_kicked (room_id, user_email, kicked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

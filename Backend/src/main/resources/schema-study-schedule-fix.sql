-- 스터디 일정 추가 시 "Field 'schedule_id' doesn't have a default value" 등 INSERT 실패 방지

USE onsil;

-- 1. schedule_id를 자동 증가로 설정 (이미 AUTO_INCREMENT면 에러 가능 → 한 줄만 실행)
ALTER TABLE study_schedule MODIFY COLUMN schedule_id BIGINT NOT NULL AUTO_INCREMENT;

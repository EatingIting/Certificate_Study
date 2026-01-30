-- schedule_id를 BIGINT → VARCHAR(36)으로 변경 (study_schedule.schedule_id UUID와 호환)
-- Error 3780 해결: 반드시 1 → 2 → 3 순서로, 각 블록을 따로 실행하세요.

USE onsil;

-- (선택) 0단계: study_schedule.schedule_id가 CHAR/다른 콜레이션이면 먼저 통일
-- ALTER TABLE study_schedule
--   MODIFY COLUMN schedule_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- ========== 1단계: 외래키만 제거 (먼저 실행) ==========
ALTER TABLE meeting_room DROP FOREIGN KEY meeting_room_ibfk_2;
ALTER TABLE meetingroom_participant DROP FOREIGN KEY fk_participant_schedule;


-- ========== 2단계: 컬럼 타입 변경 (1단계 성공 후 실행) ==========
-- study_schedule.schedule_id와 동일하게: VARCHAR(36), 문자집합/콜레이션 일치
ALTER TABLE meeting_room
  MODIFY COLUMN schedule_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE meetingroom_participant
  MODIFY COLUMN schedule_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;


-- ========== 3단계: 외래키 재생성 (2단계 성공 후 실행) ==========
-- 3단계에서 3780이 나오면: study_schedule.schedule_id 정의 확인 후 위와 동일하게 맞추기
-- SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = 'onsil' AND TABLE_NAME = 'study_schedule' AND COLUMN_NAME = 'schedule_id';
ALTER TABLE meeting_room
  ADD CONSTRAINT meeting_room_ibfk_2
  FOREIGN KEY (schedule_id) REFERENCES study_schedule(schedule_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE meetingroom_participant
  ADD CONSTRAINT fk_participant_schedule
  FOREIGN KEY (schedule_id) REFERENCES study_schedule(schedule_id) ON DELETE SET NULL ON UPDATE CASCADE;

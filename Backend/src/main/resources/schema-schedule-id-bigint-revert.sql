-- study_schedule.schedule_id가 BIGINT이므로, 참조 컬럼도 BIGINT로 유지/복원
-- (이미 VARCHAR(36)으로 바꾼 경우 이 스크립트로 BIGINT NULL로 되돌린 뒤 FK 재생성)

USE onsil;

-- 1. FK가 남아 있으면 먼저 제거 (이미 제거했으면 해당 줄은 에러 나올 수 있음 → 무시)
ALTER TABLE meeting_room DROP FOREIGN KEY meeting_room_ibfk_2;
-- meetingroom_participant FK 이름이 다를 수 있음. 안 되면 아래로 테이블 정의 확인:
-- SHOW CREATE TABLE meetingroom_participant;
ALTER TABLE meetingroom_participant DROP FOREIGN KEY fk_participant_schedule;

-- 2. schedule_id를 study_schedule과 동일하게 BIGINT NULL로 설정/복원
ALTER TABLE meeting_room MODIFY COLUMN schedule_id BIGINT NULL;
ALTER TABLE meetingroom_participant MODIFY COLUMN schedule_id BIGINT NULL;

-- 3. 외래키 재생성
ALTER TABLE meeting_room
  ADD CONSTRAINT meeting_room_ibfk_2
  FOREIGN KEY (schedule_id) REFERENCES study_schedule(schedule_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE meetingroom_participant
  ADD CONSTRAINT fk_participant_schedule
  FOREIGN KEY (schedule_id) REFERENCES study_schedule(schedule_id) ON DELETE SET NULL ON UPDATE CASCADE;

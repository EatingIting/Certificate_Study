-- [필수] schedule_id를 NULL 허용으로 변경
-- schedule_id를 구할 수 없을 때도 meeting_room / meetingroom_participant에 subject_id, room_id 등이 저장되려면
-- 반드시 아래를 MySQL Workbench 또는 CLI에서 onsil DB에 실행하세요.
-- 실행하지 않으면 "Column 'schedule_id' cannot be null" 등으로 INSERT가 실패합니다.

USE onsil;

ALTER TABLE meeting_room MODIFY COLUMN schedule_id BIGINT NULL;
ALTER TABLE meetingroom_participant MODIFY COLUMN schedule_id BIGINT NULL;

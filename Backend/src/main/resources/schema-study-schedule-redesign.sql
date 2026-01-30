-- study_schedule 재설계: schedule_id = round_num (항상 동일), AUTO_INCREMENT 제거
-- 복합 PK (subject_id, schedule_id) → 과목별 회차 1, 2, 3...

USE onsil;

-- ========== 1. 기존 FK 제거 (meeting_room, meetingroom_participant) ==========
ALTER TABLE meeting_room DROP FOREIGN KEY meeting_room_ibfk_2;
ALTER TABLE meetingroom_participant DROP FOREIGN KEY fk_participant_schedule;

-- ========== 2. study_schedule 백업 후 삭제 (필요 시 백업 테이블로 복사 후 실행) ==========
-- CREATE TABLE study_schedule_backup AS SELECT * FROM study_schedule;
DROP TABLE IF EXISTS study_schedule;

-- ========== 3. study_schedule 새 정의 ==========
-- schedule_id = round_num (동일 값 유지), 복합 PK (subject_id, schedule_id)
CREATE TABLE study_schedule (
    subject_id   VARCHAR(36)  NOT NULL COMMENT 'LMS 과목 UUID',
    schedule_id  INT          NOT NULL COMMENT '회차 번호 (round_num과 동일)',
    round_num    INT          NOT NULL COMMENT '회차 (schedule_id와 동일)',
    study_date   DATE         NOT NULL,
    start_time   TIME         NULL DEFAULT '13:00:00',
    end_time     TIME         NULL DEFAULT '15:00:00',
    description  VARCHAR(500) NULL,
    PRIMARY KEY (subject_id, schedule_id),
    CONSTRAINT chk_schedule_round CHECK (schedule_id = round_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT '스터디 일정 (schedule_id=round_num)';

-- ========== 4. meeting_room / meetingroom_participant의 schedule_id 타입 (INT로 통일 권장) ==========
-- study_schedule.schedule_id가 INT이므로 참조 컬럼도 INT 권장 (BIGINT여도 1,2,3 값은 호환)
-- ALTER TABLE meeting_room MODIFY COLUMN schedule_id INT NULL;
-- ALTER TABLE meetingroom_participant MODIFY COLUMN schedule_id INT NULL;

-- ========== 5. meeting_room / meetingroom_participant FK 재생성 (복합 FK) ==========
-- schedule_id가 NULL인 행은 FK 검사에서 제외됨 (MySQL 동작)
ALTER TABLE meeting_room
  ADD CONSTRAINT meeting_room_ibfk_2
  FOREIGN KEY (subject_id, schedule_id) REFERENCES study_schedule(subject_id, schedule_id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE meetingroom_participant
  ADD CONSTRAINT fk_participant_schedule
  FOREIGN KEY (subject_id, schedule_id) REFERENCES study_schedule(subject_id, schedule_id)
  ON DELETE SET NULL ON UPDATE CASCADE;

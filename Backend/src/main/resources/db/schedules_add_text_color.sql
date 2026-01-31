-- 일정 글자색 저장용 컬럼 추가 (배경색과 함께 사용자 선택 색 적용)
ALTER TABLE schedules
ADD COLUMN text_color VARCHAR(7) NULL DEFAULT '#ffffff' COMMENT '글자색 ex) #ffffff, #1f2937'
AFTER color_hex;

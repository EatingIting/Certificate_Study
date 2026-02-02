-- schedules에 글자색 저장 컬럼 추가 (일정 추가/수정 모달에서 선택한 textColor 유지)
-- 이미 컬럼이 있으면 에러가 날 수 있으니 필요 시 조건부로 적용하세요.

ALTER TABLE schedules
  ADD COLUMN text_color VARCHAR(7) NOT NULL DEFAULT '#ffffff' AFTER color_hex;


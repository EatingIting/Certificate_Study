package com.example.demo.schedule.converter;

import com.example.demo.schedule.vo.ScheduleVO;
import com.example.demo.schedule.vo.StudyScheduleVO;
import com.example.demo.dto.schedule.ScheduleEventResponse;

import java.sql.Date;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

public class ScheduleEventConverter {

    private ScheduleEventConverter() {}

    public static ScheduleEventResponse fromSchedule(ScheduleVO vo) {
        if (vo == null) return null;

        String start = toIso(vo.getStartAt());
        String end = toExclusiveEndOrNull(vo.getStartAt(), vo.getEndAt());

        Map<String, Object> extendedProps = new HashMap<>();
        extendedProps.put("type", vo.getType());
        extendedProps.put("description", vo.getDescription());
        extendedProps.put("customLabel", vo.getCustomTypeLabel());

        // DB에 textColor가 없으니 일단 기본값(프론트/디자인에서 나중에 통일 가능)
        String textColor = "#ffffff";

        return ScheduleEventResponse.builder()
                .id(String.valueOf(vo.getScheduleId()))
                .title(vo.getTitle())
                .start(start)
                .end(end)
                .extendedProps(extendedProps)
                .backgroundColor(vo.getColorHex())
                .borderColor(vo.getColorHex())
                .textColor(textColor)
                .build();
    }

    public static ScheduleEventResponse fromStudySchedule(StudyScheduleVO vo) {
        if (vo == null) return null;

        String start = toIso(vo.getStudyDate());

        Map<String, Object> extendedProps = new HashMap<>();
        extendedProps.put("type", "STUDY");
        extendedProps.put("round", vo.getRoundNum());
        extendedProps.put("description", vo.getDescription());

        // 스터디 일정은 실제 bar를 숨기고 칸 상단에 "n회차"만 표시하는 구조라
        // 색이 크게 중요하진 않지만, 혹시 렌더될 때 대비해 기본값만 지정
        String bg = "#E9FADC";
        String text = "#2F6A2F";

        return ScheduleEventResponse.builder()
                .id("S" + vo.getStudyScheduleId())
                .title(vo.getRoundNum() + "회차")
                .start(start)
                .end(null)
                .extendedProps(extendedProps)
                .backgroundColor(bg)
                .borderColor(bg)
                .textColor(text)
                .build();
    }

    private static String toIso(Date date) {
        if (date == null) return null;
        return date.toLocalDate().toString(); // YYYY-MM-DD
    }

    /**
     * DB는 inclusive end 저장.
     * FullCalendar는 end가 exclusive.
     *
     * - start == end (하루) -> end=null
     * - start < end (기간)  -> end = endInclusive + 1 day
     */
    private static String toExclusiveEndOrNull(Date startAt, Date endAtInclusive) {
        if (startAt == null || endAtInclusive == null) return null;

        LocalDate s = startAt.toLocalDate();
        LocalDate e = endAtInclusive.toLocalDate();

        if (s.isEqual(e)) {
            return null;
        }

        // 데이터가 이상하게 들어온 경우(끝이 시작보다 앞)도 방어
        if (e.isBefore(s)) {
            return null;
        }

        return e.plusDays(1).toString();
    }
}

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

        String textColor = (vo.getTextColor() != null && !vo.getTextColor().isBlank())
                ? vo.getTextColor() : "#ffffff";

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

        String dateStr = toIso(vo.getStudyDate());
        String startTime = normalizeTimeForIso(vo.getStartTime());
        String endTime = normalizeTimeForIso(vo.getEndTime());
        String start = (startTime != null) ? dateStr + "T" + startTime : dateStr;
        String end = (endTime != null) ? dateStr + "T" + endTime : null;

        Map<String, Object> extendedProps = new HashMap<>();
        extendedProps.put("type", "STUDY");
        extendedProps.put("round", vo.getRoundNum());
        extendedProps.put("description", vo.getDescription());
        if (startTime != null) extendedProps.put("startTime", toHHmm(startTime));
        if (endTime != null) extendedProps.put("endTime", toHHmm(endTime));

        String bg = "#E9FADC";
        String text = "#2F6A2F";

        return ScheduleEventResponse.builder()
                .id("S" + vo.getStudyScheduleId())
                .title(vo.getRoundNum() + "회차")
                .start(start)
                .end(end)
                .extendedProps(extendedProps)
                .backgroundColor(bg)
                .borderColor(bg)
                .textColor(text)
                .build();
    }

    /** "HH:mm:ss" 또는 "HH:mm" → "HH:mm:ss" (ISO용) */
    private static String normalizeTimeForIso(String time) {
        if (time == null || time.isBlank()) return null;
        String t = time.trim();
        if (t.length() == 5) return t + ":00"; // HH:mm -> HH:mm:ss
        return t.length() >= 8 ? t.substring(0, 8) : t; // HH:mm:ss
    }

    /** "HH:mm:ss" → "HH:mm" (프론트 time input용) */
    private static String toHHmm(String time) {
        if (time == null || time.length() < 5) return time;
        return time.substring(0, 5);
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

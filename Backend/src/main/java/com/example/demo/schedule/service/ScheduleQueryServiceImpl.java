package com.example.demo.schedule.service;

import com.example.demo.dto.schedule.ScheduleEventResponse;
import com.example.demo.dto.schedule.ScheduleListResponse;
import com.example.demo.schedule.converter.ScheduleEventConverter;
import com.example.demo.schedule.vo.ScheduleVO;
import com.example.demo.schedule.vo.StudyScheduleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleQueryServiceImpl implements ScheduleQueryService {

    private final ScheduleService scheduleService;
    private final StudyScheduleService studyScheduleService;

    @Override
    public ScheduleListResponse getCalendarEvents(String roomId, String start, String end) {
        Date startDate = Date.valueOf(LocalDate.parse(start));
        Date endExclusiveDate = Date.valueOf(LocalDate.parse(end));

        // ✅ 여기만 바뀜
        List<ScheduleVO> schedules = scheduleService.selectByRange(roomId, startDate, endExclusiveDate);
        List<StudyScheduleVO> studySchedules = studyScheduleService.selectByRange(roomId, startDate, endExclusiveDate);

        List<ScheduleEventResponse> items = new ArrayList<>();

        for (ScheduleVO vo : schedules) {
            items.add(ScheduleEventConverter.fromSchedule(vo));
        }
        for (StudyScheduleVO vo : studySchedules) {
            items.add(ScheduleEventConverter.fromStudySchedule(vo));
        }

        return ScheduleListResponse.builder().items(items).build();
    }
}
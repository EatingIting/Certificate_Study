package com.example.demo.schedule.service;


import com.example.demo.dto.schedule.StudyScheduleCreateRequest;
import com.example.demo.dto.schedule.StudyScheduleUpdateRequest;
import com.example.demo.roomcontext.CurrentUserUtil;
import com.example.demo.roomparticipant.RoomParticipantMapper;
import com.example.demo.schedule.mapper.StudyScheduleMapper;
import com.example.demo.schedule.vo.StudyScheduleVO;
import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Repository.MeetingRoomKickedUserRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomParticipantRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudyScheduleServiceImpl implements StudyScheduleService {

    private final StudyScheduleMapper studyScheduleMapper;
    private final MeetingRoomRepository meetingRoomRepository;
    private final MeetingRoomParticipantRepository participantRepository;
    private final MeetingRoomKickedUserRepository kickedUserRepository;
    private final EntityManager entityManager;
    private final RoomParticipantMapper roomParticipantMapper;
    private final CurrentUserUtil currentUserUtil;

    private void requireHost(String roomId) {
        String email = currentUserUtil.getCurrentUserEmail();
        String hostEmail = roomParticipantMapper.selectHostEmail(roomId);

        if (hostEmail == null || email == null || !hostEmail.trim().equalsIgnoreCase(email.trim())) {
            throw new AccessDeniedException("방장만 접근 가능합니다.");
        }
    }

    @Override
    public List<StudyScheduleVO> selectByRange(String roomId, Date start, Date endExclusive) {
        return studyScheduleMapper.selectByRange(roomId, start, endExclusive);
    }

    @Override
    public List<StudyScheduleVO> selectAnyBySubjectId(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return List.of();
        try {
            return studyScheduleMapper.selectAnyBySubjectId(subjectId);
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String normalizeTime(String time) {
        if (time == null || time.isBlank()) return null;
        String t = time.trim();
        if (t.length() == 5) return t + ":00"; // HH:mm -> HH:mm:00
        return t;
    }

    @Override
    @Transactional
    public Long insert(StudyScheduleCreateRequest req) {
        String subjectId = req.getRoomId();
        requireHost(subjectId);
        String startTime = normalizeTime(req.getStartTime());
        String endTime = normalizeTime(req.getEndTime());
        if (startTime == null) startTime = "09:00:00";
        if (endTime == null) endTime = "11:00:00";

        StudyScheduleVO vo = StudyScheduleVO.builder()
                .subjectId(subjectId)
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .startTime(startTime)
                .endTime(endTime)
                .description(req.getDescription() != null ? req.getDescription() : "")
                .build();

        try {
            studyScheduleMapper.insert(vo);
            // schedule_id = round_num 이므로 생성된 ID가 아닌 회차 번호 반환
            return Long.valueOf(req.getRound());
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException(
                    "이미 해당 과목의 " + req.getRound() + "회차 일정이 등록되어 있습니다. 다른 회차를 선택하세요.");
        }
    }

    @Override
    @Transactional
    public void update(
            Long studyScheduleId,
            String roomId,
            StudyScheduleUpdateRequest req) {
        requireHost(roomId);
        String startTime = normalizeTime(req.getStartTime());
        String endTime = normalizeTime(req.getEndTime());

        StudyScheduleVO vo = StudyScheduleVO.builder()
                .studyScheduleId(studyScheduleId)
                .subjectId(roomId)
                .roundNum(req.getRound())
                .studyDate(Date.valueOf(LocalDate.parse(req.getDate())))
                .startTime(startTime)
                .endTime(endTime)
                .description(req.getDescription() != null ? req.getDescription() : "")
                .build();

        int updated = studyScheduleMapper.update(vo);
        if (updated == 0) {
            throw new IllegalArgumentException("해당 스터디 일정이 없거나 수정할 수 없습니다. id=" + studyScheduleId);
        }
    }

    @Override
    @Transactional
    public void delete(Long studyScheduleId, String roomId) {
        requireHost(roomId);
        // roomId = subject_id. FK 제약(study_schedule <- meeting_room) 때문에 먼저 연관 데이터 삭제
        List<MeetingRoom> rooms = meetingRoomRepository.findBySubjectIdAndScheduleId(roomId, studyScheduleId);
        participantRepository.deleteBySubjectIdAndScheduleId(roomId, studyScheduleId);
        if (!rooms.isEmpty()) {
            List<String> roomIds = rooms.stream().map(MeetingRoom::getRoomId).collect(Collectors.toList());
            kickedUserRepository.deleteByRoomIdIn(roomIds);
        }
        // meeting_room을 네이티브 DELETE로 삭제 후 flush (JPA/MyBatis 혼용 시 즉시 반영 필요)
        meetingRoomRepository.deleteBySubjectIdAndScheduleId(roomId, studyScheduleId);
        entityManager.flush();
        int deleted = studyScheduleMapper.delete(studyScheduleId, roomId);
        if (deleted == 0) {
            throw new IllegalArgumentException("해당 스터디 일정이 없거나 삭제할 수 없습니다. id=" + studyScheduleId);
        }
    }

    @Override
    @Transactional
    public Long getOrCreateTodayScheduleId(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            throw new IllegalArgumentException("roomId는 필수입니다.");
        }
        Long activeNow = findActiveScheduleIdByCurrentTime(roomId);
        if (activeNow != null) {
            return activeNow;
        }

        Long upcomingToday = findUpcomingTodayScheduleId(roomId);
        if (upcomingToday != null) {
            return upcomingToday;
        }

        Long anyToday = findAnyTodayScheduleId(roomId);
        if (anyToday != null) {
            return anyToday;
        }

        LocalDate today = LocalDate.now();
        Date start = Date.valueOf(today);
        Date endExclusive = Date.valueOf(today.plusDays(1));
        try {
            List<StudyScheduleVO> bySubject = studyScheduleMapper.selectBySubjectIdAndRange(roomId, start, endExclusive);
            if (!bySubject.isEmpty()) {
                return bySubject.get(0).getStudyScheduleId();
            }
            StudyScheduleVO vo = StudyScheduleVO.builder()
                    .subjectId(roomId)
                    .roundNum(1)
                    .studyDate(start)
                    .startTime("09:00:00")
                    .endTime("11:00:00")
                    .description("")
                    .build();
            studyScheduleMapper.insertWithSubjectId(vo);
            // schedule_id = round_num 이므로 insert 후 회차 번호(1) 반환
            return vo.getRoundNum() != null ? vo.getRoundNum().longValue() : 1L;
        } catch (Exception e) {
            // fallback
        }
        List<StudyScheduleVO> list = studyScheduleMapper.selectByRange(roomId, start, endExclusive);
        if (!list.isEmpty()) {
            return list.get(0).getStudyScheduleId();
        }
        StudyScheduleVO vo = StudyScheduleVO.builder()
                .subjectId(roomId)
                .roundNum(1)
                .studyDate(start)
                .startTime("09:00:00")
                .endTime("11:00:00")
                .description("")
                .build();
        studyScheduleMapper.insert(vo);
        return vo.getRoundNum() != null ? vo.getRoundNum().longValue() : 1L;
    }

    @Override
    public int getNextRoundNum(String roomId) {
        if (roomId == null || roomId.isBlank()) return 1;
        Integer max = studyScheduleMapper.selectMaxRoundNumBySubjectId(roomId.trim());
        return (max != null && max >= 0) ? max + 1 : 1;
    }

    @Override
    public Long findActiveScheduleIdByCurrentTime(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return null;
        try {
            return studyScheduleMapper.selectScheduleIdBySubjectIdAndCurrentTime(subjectId.trim());
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public Long findUpcomingTodayScheduleId(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return null;
        try {
            return studyScheduleMapper.selectUpcomingTodayScheduleId(subjectId.trim());
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public Long findAnyTodayScheduleId(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return null;
        try {
            return studyScheduleMapper.selectAnyTodayScheduleId(subjectId.trim());
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public StudyScheduleVO getBySubjectIdAndScheduleId(String subjectId, Long scheduleId) {
        if (subjectId == null || subjectId.isBlank() || scheduleId == null) return null;
        try {
            return studyScheduleMapper.selectBySubjectIdAndScheduleId(subjectId.trim(), scheduleId);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public StudyScheduleVO getNextSessionTodayAfter(String subjectId, Long afterScheduleId) {
        if (subjectId == null || subjectId.isBlank() || afterScheduleId == null) return null;
        try {
            return studyScheduleMapper.selectNextSessionToday(subjectId.trim(), afterScheduleId);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public StudyScheduleVO getNextSessionOnDateAfter(String subjectId, Date studyDate, Long afterScheduleId) {
        if (subjectId == null || subjectId.isBlank() || studyDate == null || afterScheduleId == null) return null;
        try {
            return studyScheduleMapper.selectNextSessionOnDate(subjectId.trim(), studyDate, afterScheduleId);
        } catch (Exception e) {
            return null;
        }
    }
}

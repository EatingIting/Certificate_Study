package com.example.demo.화상채팅.Service;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import com.example.demo.화상채팅.Repository.MeetingRoomParticipantRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomRepository;
import com.example.demo.schedule.service.StudyScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.schedule.vo.StudyScheduleVO;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MeetingRoomServiceImpl implements MeetingRoomService {

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final MeetingRoomRepository meetingRoomRepository;
    private final MeetingRoomParticipantRepository participantRepository;
    private final StudyScheduleService studyScheduleService;

    @Override
    public String getRoomIdBySubjectId(String subjectId) {
        if (subjectId == null || subjectId.trim().isEmpty()) {
            log.warn("[MeetingRoomServiceImpl] subjectId가 null이거나 비어있습니다.");
            throw new IllegalArgumentException("subjectId는 필수입니다.");
        }

        try {
            LocalDate today = LocalDate.now();
            String dateStr = today.toString();
            String seed = subjectId.trim() + "_" + dateStr;

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(seed.getBytes(StandardCharsets.UTF_8));

            StringBuilder roomId = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                int index = (hash[i % hash.length] & 0xFF) % CHARACTERS.length();
                if (index < 0) index += CHARACTERS.length();
                roomId.append(CHARACTERS.charAt(index));
            }

            String result = roomId.toString();
            log.debug("[MeetingRoomServiceImpl] subjectId={}, date={} -> roomId={}", subjectId, dateStr, result);
            return result;
        } catch (NoSuchAlgorithmException e) {
            log.error("[MeetingRoomServiceImpl] SHA-256 알고리즘을 찾을 수 없습니다.", e);
            throw new RuntimeException("SHA-256 알고리즘을 찾을 수 없습니다.", e);
        }
    }

    @Override
    public Long getOrCreateTodayScheduleId(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) {
            throw new IllegalArgumentException("subjectId는 필수입니다.");
        }
        return studyScheduleService.getOrCreateTodayScheduleId(subjectId.trim());
    }

    /**
     * 입장 시 /lms/{subjectId}/MeetingRoom/{roomId} 기준:
     * - subjectId → subject_id (DB), scheduleId는 이 subject 기준 오늘 회차로 조회/생성
     * - roomId → 서버에서 내려준 난수(8자) → room_id (meeting_room / meetingroom_participant)
     * REQUIRES_NEW: DB 오류 시 이 트랜잭션만 롤백하고 WebSocket 입장은 유지.
     */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void handleJoin(String roomId, String userEmail, String title, boolean isHost,
                           String subjectId, Long scheduleId) {
        System.out.println("🔵 [MeetingRoomService] handleJoin 호출");
        System.out.println("   roomId: " + roomId + " (→ room_id 저장)");
        System.out.println("   userEmail: " + userEmail);
        System.out.println("   title: " + title);
        System.out.println("   isHost: " + isHost);
        System.out.println("   subjectId: " + subjectId + " (→ subject_id 저장)");
        System.out.println("   scheduleId: " + scheduleId);

        if (userEmail == null || userEmail.isBlank()) {
            System.out.println("⚠️ userEmail이 null 또는 빈값입니다. 저장하지 않습니다.");
            return;
        }

        String safeSubjectId = (subjectId != null && !subjectId.isBlank()) ? subjectId.trim() : "";
        // 참여자이고 subjectId가 비어 있으면 이미 생성된 meeting_room에서 room_id로 subject_id 조회
        if (!isHost && safeSubjectId.isEmpty() && roomId != null && !roomId.isBlank()) {
            Optional<String> subjectFromRoom = meetingRoomRepository.findByIdRoomId(roomId)
                    .map(MeetingRoom::getSubjectId)
                    .filter(s -> s != null && !s.isBlank())
                    .map(String::trim);
            if (subjectFromRoom.isPresent()) {
                safeSubjectId = subjectFromRoom.get();
                log.info("[MeetingRoomServiceImpl] participant subjectId 복구: roomId={}, subjectId={}", roomId, safeSubjectId);
            }
        }

        // schedule_id: 현재 시간대 회차 우선, 없으면 오늘의 "다음 회차" 배정 (2시 전 입장 → 2시 회차 자동 배정)
        Long safeScheduleId = null;
        if (!safeSubjectId.isEmpty()) {
            safeScheduleId = studyScheduleService.findActiveScheduleIdByCurrentTime(safeSubjectId);
            if (safeScheduleId != null) {
                log.info("[MeetingRoomServiceImpl] 현재 시간대 회차 사용: subjectId={}, scheduleId={}", safeSubjectId, safeScheduleId);
            } else {
                safeScheduleId = studyScheduleService.findUpcomingTodayScheduleId(safeSubjectId);
                if (safeScheduleId != null) {
                    log.info("[MeetingRoomServiceImpl] 다음 회차 배정(시작 전 입장): subjectId={}, scheduleId={}", safeSubjectId, safeScheduleId);
                } else {
                    log.info("[MeetingRoomServiceImpl] 스터디 일정 시간대가 아님, 오늘 다음 회차도 없음 → schedule_id=null");
                }
            }
        }

        if (isHost) {
            if (safeSubjectId.isEmpty()) {
                log.warn("[MeetingRoomServiceImpl] 호스트 입장 시 subjectId 없음 → meeting_room 저장 건너뜀");
                return;
            }
            MeetingRoomId id = new MeetingRoomId(roomId, userEmail);
            Optional<MeetingRoom> existingRoom = meetingRoomRepository.findById(id);

            if (existingRoom.isEmpty()) {
                MeetingRoom room = new MeetingRoom(roomId, userEmail, safeSubjectId, safeScheduleId);
                meetingRoomRepository.save(room);
                log.info("[MeetingRoomServiceImpl] meeting_room 저장 완료 (schedule_id={})", safeScheduleId);
            } else {
                MeetingRoom room = existingRoom.get();
                room.rejoin();
                meetingRoomRepository.save(room);
                log.info("[MeetingRoomServiceImpl] 재입장 - ended_at 초기화");
            }
            // 호스트도 입장 로그를 meetingroom_participant에 기록
            insertParticipantIfNeeded(safeSubjectId, safeScheduleId, roomId, userEmail);
        } else {
            // 참여자: subject_id가 있으면 무조건 participant 저장 시도 (schedule_id 없어도 nullable이므로 저장)
            if (safeSubjectId.isEmpty()) {
                log.warn("[MeetingRoomServiceImpl] 참여자 입장 시 subjectId 없음(room에서도 조회 불가) → participant 저장 불가");
                return;
            }
            insertParticipantIfNeeded(safeSubjectId, safeScheduleId, roomId, userEmail);
        }
    }

    private void insertParticipantIfNeeded(String subjectId, Long scheduleId, String roomId, String userEmail) {
        if (subjectId == null || subjectId.isBlank()) {
            log.warn("[MeetingRoomServiceImpl] participant 저장 건너뜀: subjectId가 없음");
            return;
        }
        Long effectiveScheduleId = (scheduleId != null && scheduleId > 0) ? scheduleId : null;

        try {
            if (effectiveScheduleId != null) {
                Optional<MeetingRoomParticipant> existing = participantRepository
                        .findByScheduleIdAndRoomIdAndUserEmailAndLeftAtIsNull(effectiveScheduleId, roomId, userEmail);
                if (existing.isPresent()) {
                    MeetingRoomParticipant participant = existing.get();
                    participant.rejoin();
                    participantRepository.save(participant);
                    log.info("[MeetingRoomServiceImpl] 재입장 - left_at 초기화 (schedule_id={})", effectiveScheduleId);
                    return;
                }
                Optional<MeetingRoomParticipant> anyRecord = participantRepository
                        .findByScheduleIdAndRoomIdAndUserEmail(effectiveScheduleId, roomId, userEmail);
                if (anyRecord.isPresent()) {
                    MeetingRoomParticipant participant = anyRecord.get();
                    participant.rejoin();
                    participantRepository.save(participant);
                    log.info("[MeetingRoomServiceImpl] 재입장 - left_at 초기화");
                    return;
                }
            } else {
                Optional<MeetingRoomParticipant> existingNullSchedule = participantRepository
                        .findFirstByRoomIdAndUserEmailAndLeftAtIsNull(roomId, userEmail);
                if (existingNullSchedule.isPresent()) {
                    MeetingRoomParticipant participant = existingNullSchedule.get();
                    participant.rejoin();
                    participantRepository.save(participant);
                    log.info("[MeetingRoomServiceImpl] 재입장 (schedule_id=null) - left_at 초기화");
                    return;
                }
            }

            MeetingRoomParticipant participant =
                    new MeetingRoomParticipant(subjectId, effectiveScheduleId, roomId, userEmail);
            participantRepository.save(participant);
            log.info("[MeetingRoomServiceImpl] meetingroom_participant 저장 완료 (schedule_id={}, room_id={}, user_email={})",
                    effectiveScheduleId, roomId, userEmail);
        } catch (Exception e) {
            log.error("[MeetingRoomServiceImpl] meetingroom_participant 저장 실패 (입장 로그 누락 가능): roomId={}, userEmail={}, error={}",
                    roomId, userEmail, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 같은 날 다음 회차로 넘어갔을 때, 방에 그대로 있는 참가자를 새 회차 참가자로 배정.
     * PING 등에서 주기적으로 호출.
     */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void checkAndAssignNewSessionIfNeeded(String roomId, String userEmail) {
        if (roomId == null || roomId.isBlank() || userEmail == null || userEmail.isBlank()) return;

        String subjectId = meetingRoomRepository.findByIdRoomId(roomId)
                .map(MeetingRoom::getSubjectId)
                .filter(s -> s != null && !s.isBlank())
                .orElse(null);
        if (subjectId == null) return;

        Optional<MeetingRoomParticipant> openOpt = participantRepository
                .findFirstByRoomIdAndUserEmailAndLeftAtIsNull(roomId, userEmail);
        if (openOpt.isEmpty()) return;

        Long currentScheduleId = studyScheduleService.findActiveScheduleIdByCurrentTime(subjectId);
        MeetingRoomParticipant open = openOpt.get();

        if (currentScheduleId != null && Objects.equals(open.getScheduleId(), currentScheduleId)) return;

        try {
            if (currentScheduleId != null) {
                open.leave();
                participantRepository.save(open);
                MeetingRoomParticipant newParticipant = new MeetingRoomParticipant(
                        subjectId, currentScheduleId, roomId, userEmail);
                participantRepository.save(newParticipant);
                log.info("[MeetingRoomServiceImpl] 회차 전환 배정: roomId={}, userEmail={}, 이전 schedule_id={} → 현재 {}",
                        roomId, userEmail, open.getScheduleId(), currentScheduleId);
                return;
            }

            // 캐치업: 현재 활성 회차 없음 → 이전 회차 종료 처리 후, 이미 시작된 다음 회차가 있으면 해당 회차 레코드 생성 (2→3→4 연속 시 4회차 놓치는 경우 방지)
            StudyScheduleVO openSession = studyScheduleService.getBySubjectIdAndScheduleId(subjectId, open.getScheduleId());
            if (openSession != null && openSession.getStudyDate() != null && openSession.getEndTime() != null) {
                LocalDate ld = openSession.getStudyDate().toLocalDate();
                String endStr = openSession.getEndTime().length() == 5 ? openSession.getEndTime() + ":00" : openSession.getEndTime();
                LocalTime endTime = LocalTime.parse(endStr);
                open.setLeftAt(LocalDateTime.of(ld, endTime));
                participantRepository.save(open);
            } else {
                open.leave();
                participantRepository.save(open);
            }

            // 열린 참가자의 study_date 기준 다음 회차 조회 (CURDATE/서버 타임존 무관 → 2·3·4회차 연속 시 4회차 누락 방지)
            java.sql.Date openStudyDate = (openSession != null) ? openSession.getStudyDate() : null;
            StudyScheduleVO nextSession = openStudyDate != null
                    ? studyScheduleService.getNextSessionOnDateAfter(subjectId, openStudyDate, open.getScheduleId())
                    : studyScheduleService.getNextSessionTodayAfter(subjectId, open.getScheduleId());
            if (nextSession == null || nextSession.getStudyDate() == null || nextSession.getStartTime() == null) return;

            LocalDate nextDate = nextSession.getStudyDate().toLocalDate();
            String startStr = nextSession.getStartTime().length() == 5 ? nextSession.getStartTime() + ":00" : nextSession.getStartTime();
            LocalDateTime nextStart = LocalDateTime.of(nextDate, LocalTime.parse(startStr));
            if (LocalDateTime.now().isBefore(nextStart)) return;

            MeetingRoomParticipant newParticipant = new MeetingRoomParticipant(
                    subjectId, nextSession.getStudyScheduleId(), roomId, userEmail);
            newParticipant.setJoinedAt(nextStart);
            participantRepository.save(newParticipant);
            log.info("[MeetingRoomServiceImpl] 회차 캐치업 배정: roomId={}, userEmail={}, 다음 schedule_id={} (joined_at={})",
                    roomId, userEmail, nextSession.getStudyScheduleId(), nextStart);
        } catch (Exception e) {
            log.warn("[MeetingRoomServiceImpl] 회차 전환/캐치업 배정 실패: roomId={}, userEmail={}, error={}",
                    roomId, userEmail, e.getMessage());
        }
    }

    @Override
    public void handleLeave(String roomId, String userEmail, boolean isHost) {
        System.out.println("🔴 [MeetingRoomService] handleLeave 호출");
        System.out.println("   roomId: " + roomId);
        System.out.println("   userEmail: " + userEmail);
        System.out.println("   isHost: " + isHost);

        if (userEmail == null || userEmail.isBlank()) {
            System.out.println("⚠️ userEmail이 null 또는 빈값입니다. 업데이트하지 않습니다.");
            return;
        }

        if (isHost) {
            MeetingRoomId id = new MeetingRoomId(roomId, userEmail);
            meetingRoomRepository.findById(id).ifPresentOrElse(
                    room -> {
                        room.endMeeting();
                        meetingRoomRepository.save(room);
                        System.out.println("✅ meeting_room ended_at 업데이트 완료");
                    },
                    () -> System.out.println("⚠️ 해당 방을 찾을 수 없습니다.")
            );
            // 호스트도 meetingroom_participant에 left_at 기록
            participantRepository.findFirstByRoomIdAndUserEmailAndLeftAtIsNull(roomId, userEmail)
                    .ifPresentOrElse(
                            participant -> {
                                participant.leave();
                                participantRepository.save(participant);
                                log.info("[MeetingRoomServiceImpl] 호스트 participant left_at 업데이트 완료");
                            },
                            () -> log.debug("[MeetingRoomServiceImpl] 호스트 participant 기록 없음 (과거 버전 입장)")
                    );
        } else {
            participantRepository.findFirstByRoomIdAndUserEmailAndLeftAtIsNull(roomId, userEmail)
                    .ifPresentOrElse(
                            participant -> {
                                participant.leave();
                                participantRepository.save(participant);
                                System.out.println("✅ participant left_at 업데이트 완료");
                            },
                            () -> System.out.println("⚠️ 해당 참여자를 찾을 수 없습니다.")
                    );
        }
    }
}

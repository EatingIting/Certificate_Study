package com.example.demo.화상채팅.Service;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import com.example.demo.화상채팅.Domain.MeetingRoomKickedUser;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import com.example.demo.화상채팅.Repository.MeetingRoomKickedUserRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomParticipantRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomRepository;
import com.example.demo.schedule.service.StudyScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MeetingRoomServiceImpl implements MeetingRoomService {

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final MeetingRoomRepository meetingRoomRepository;
    private final MeetingRoomParticipantRepository participantRepository;
    private final MeetingRoomKickedUserRepository kickedUserRepository;
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

        // schedule_id: 스터디 일정 시간대 안에 들어왔을 때 해당 회차, 그 외에는 오늘 회차 조회/생성 (meeting_room.schedule_id NOT NULL 대응)
        Long safeScheduleId = null;
        if (!safeSubjectId.isEmpty()) {
            safeScheduleId = studyScheduleService.findActiveScheduleIdByCurrentTime(safeSubjectId);
            if (safeScheduleId != null) {
                log.info("[MeetingRoomServiceImpl] 현재 시간대 회차 사용: subjectId={}, scheduleId={}", safeSubjectId, safeScheduleId);
            } else {
                try {
                    safeScheduleId = studyScheduleService.getOrCreateTodayScheduleId(safeSubjectId);
                    log.info("[MeetingRoomServiceImpl] 일정 시간대 아님 → 오늘 회차 사용: subjectId={}, scheduleId={}", safeSubjectId, safeScheduleId);
                } catch (Exception e) {
                    log.warn("[MeetingRoomServiceImpl] 오늘 회차 조회/생성 실패 → schedule_id=null: {}", e.getMessage());
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
                // DB의 meeting_room.schedule_id가 NOT NULL이면 null 불가 → 오늘 회차로 보정
                Long scheduleIdForRoom = safeScheduleId;
                if (scheduleIdForRoom == null) {
                    try {
                        scheduleIdForRoom = studyScheduleService.getOrCreateTodayScheduleId(safeSubjectId);
                    } catch (Exception e) {
                        log.warn("[MeetingRoomServiceImpl] meeting_room 저장 전 schedule_id 보정 실패: {}", e.getMessage());
                    }
                }
                if (scheduleIdForRoom == null) {
                    log.warn("[MeetingRoomServiceImpl] schedule_id를 확보할 수 없어 meeting_room 저장 건너뜀 (입장은 계속됨)");
                } else {
                    MeetingRoom room = new MeetingRoom(roomId, userEmail, safeSubjectId, scheduleIdForRoom);
                    meetingRoomRepository.save(room);
                    log.info("[MeetingRoomServiceImpl] meeting_room 저장 완료 (schedule_id={})", scheduleIdForRoom);
                }
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
                // schedule_id=null인 행만 재사용 (다른 회차(schedule_id=1,2…) 행 재사용 방지 → 2회차 입장 시 새 행 생성)
                Optional<MeetingRoomParticipant> existingNullSchedule = participantRepository
                        .findFirstByRoomIdAndUserEmailAndScheduleIdIsNullAndLeftAtIsNull(roomId, userEmail);
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

    @Override
    public void recordKicked(String roomId, String userEmail) {
        if (roomId == null || roomId.isBlank() || userEmail == null || userEmail.isBlank()) return;
        kickedUserRepository.save(new MeetingRoomKickedUser(roomId.trim(), userEmail.trim()));
        log.info("[MeetingRoomServiceImpl] 강퇴 기록: roomId={}, userEmail={}", roomId, userEmail);
    }

    @Override
    public boolean isKickedToday(String roomId, String userEmail) {
        if (roomId == null || roomId.isBlank() || userEmail == null || userEmail.isBlank()) return false;
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(23, 59, 59, 999_999_999);
        return kickedUserRepository.findFirstByRoomIdAndUserEmailAndKickedAtBetween(
                roomId.trim(), userEmail.trim(), startOfDay, endOfDay
        ).isPresent();
    }
}

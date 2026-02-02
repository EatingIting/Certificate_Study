package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface MeetingRoomParticipantRepository extends JpaRepository<MeetingRoomParticipant, Long> {

    Optional<MeetingRoomParticipant> findByScheduleIdAndRoomIdAndUserEmail(
            Long scheduleId, String roomId, String userEmail);

    Optional<MeetingRoomParticipant> findByScheduleIdAndRoomIdAndUserEmailAndLeftAtIsNull(
            Long scheduleId, String roomId, String userEmail);

    /** 퇴장 시 roomId + userEmail로 원래 행 찾아 left_at만 갱신 (재입장 시 새 행 안 만들므로 left_at 여부 무관) */
    Optional<MeetingRoomParticipant> findFirstByRoomIdAndUserEmailOrderByParticipantIdDesc(
            String roomId, String userEmail);

    /** schedule_id가 null인 참가 중인 행만 찾기 (null 입장 시 다른 회차 행 재사용 방지) */
    Optional<MeetingRoomParticipant> findFirstByRoomIdAndUserEmailAndScheduleIdIsNullAndLeftAtIsNull(
            String roomId, String userEmail);

    /** schedule_id가 null인 행 존재 여부 (재입장 시 새 행 생성 여부 판단) */
    Optional<MeetingRoomParticipant> findFirstByRoomIdAndUserEmailAndScheduleIdIsNull(
            String roomId, String userEmail);

    /** 일정 삭제 시 해당 room_id들에 대한 참가 기록 일괄 삭제 */
    void deleteByRoomIdIn(Collection<String> roomIds);

    /** 일정 삭제 시 해당 (subject_id, schedule_id) 참가 기록 일괄 삭제 */
    void deleteBySubjectIdAndScheduleId(String subjectId, Long scheduleId);
}

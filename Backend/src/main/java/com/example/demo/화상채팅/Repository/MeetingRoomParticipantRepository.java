package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MeetingRoomParticipantRepository extends JpaRepository<MeetingRoomParticipant, Long> {

    Optional<MeetingRoomParticipant> findByScheduleIdAndRoomIdAndUserEmail(
            Long scheduleId, String roomId, String userEmail);

    Optional<MeetingRoomParticipant> findByScheduleIdAndRoomIdAndUserEmailAndLeftAtIsNull(
            Long scheduleId, String roomId, String userEmail);

    /** 퇴장 시 roomId + userEmail로 접속 중인 참가자 레코드 찾기 (scheduleId 없이) */
    Optional<MeetingRoomParticipant> findFirstByRoomIdAndUserEmailAndLeftAtIsNull(
            String roomId, String userEmail);
}

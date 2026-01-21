package com.example.demo.repository;

import com.example.demo.domain.MeetingRoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MeetingRoomParticipantRepository
        extends JpaRepository<MeetingRoomParticipant, Long> {

    boolean existsByRoomIdAndUserId(String roomId, String userId);

    Optional<MeetingRoomParticipant>
    findByRoomIdAndUserIdAndLeftAtIsNull(String roomId, String userId);
}
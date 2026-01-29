package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipantId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MeetingRoomParticipantRepository extends JpaRepository<MeetingRoomParticipant, MeetingRoomParticipantId> {

    boolean existsByIdRoomIdAndIdUserEmail(String roomId, String userEmail);

    Optional<MeetingRoomParticipant>
    findByIdRoomIdAndIdUserEmailAndLeftAtIsNull(String roomId, String userEmail);
}

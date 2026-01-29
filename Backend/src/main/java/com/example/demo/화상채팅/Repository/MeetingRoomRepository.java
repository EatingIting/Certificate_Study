package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MeetingRoomRepository extends JpaRepository<MeetingRoom, MeetingRoomId> {

    boolean existsByIdRoomId(String roomId);

    Optional<MeetingRoom> findByIdRoomId(String roomId);
}

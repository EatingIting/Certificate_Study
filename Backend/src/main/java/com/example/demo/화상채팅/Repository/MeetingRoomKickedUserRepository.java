package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoomKickedUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface MeetingRoomKickedUserRepository extends JpaRepository<MeetingRoomKickedUser, Long> {


    Optional<MeetingRoomKickedUser> findFirstByRoomIdAndUserEmailAndKickedAtBetween(
            String roomId,
            String userEmail,
            LocalDateTime startOfDay,
            LocalDateTime endOfDay
    );
}

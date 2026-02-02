package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoomKickedUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;

public interface MeetingRoomKickedUserRepository extends JpaRepository<MeetingRoomKickedUser, Long> {

    /** 일정 삭제 시 해당 room_id들에 대한 강퇴 기록 일괄 삭제 */
    void deleteByRoomIdIn(Collection<String> roomIds);

    Optional<MeetingRoomKickedUser> findFirstByRoomIdAndUserEmailAndKickedAtBetween(
            String roomId,
            String userEmail,
            LocalDateTime startOfDay,
            LocalDateTime endOfDay
    );
}

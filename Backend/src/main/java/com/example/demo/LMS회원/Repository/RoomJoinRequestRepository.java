package com.example.demo.LMS회원.Repository;

import com.example.demo.entity.RoomJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomJoinRequestRepository extends JpaRepository<RoomJoinRequest, String> {
    List<RoomJoinRequest> findByRequestUserEmailAndStatus(String requestUserEmail, String status);
    List<RoomJoinRequest> findByRequestUserEmail(String requestUserEmail);
    List<RoomJoinRequest> findByRequestUserEmailAndRoomId(String requestUserEmail, String roomId);
    Optional<RoomJoinRequest> findFirstByRequestUserEmailAndRoomId(String requestUserEmail, String roomId);
    boolean existsByRequestUserEmailAndRoomIdAndStatus(String requestUserEmail, String roomId, String status);
    long countByRoomIdAndStatus(String roomId, String status);

    @Query("SELECT r.requestUserNickname FROM RoomJoinRequest r WHERE r.roomId = :roomId AND r.requestUserEmail = :email")
    Optional<String> findNicknameByRoomIdAndEmail(@Param("roomId") String roomId, @Param("email") String email);

    boolean existsByRoomIdAndHostUserEmail(String roomId, String hostUserEmail);
}

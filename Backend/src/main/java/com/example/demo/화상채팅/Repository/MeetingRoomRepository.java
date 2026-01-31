package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MeetingRoomRepository extends JpaRepository<MeetingRoom, MeetingRoomId> {

    boolean existsByIdRoomId(String roomId);

    Optional<MeetingRoom> findByIdRoomId(String roomId);

    /** 스터디 일정 삭제 전 해당 일정을 참조하는 meeting_room 행 삭제 (FK 제약 해소) */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM MeetingRoom r WHERE r.subjectId = :subjectId AND r.scheduleId = :scheduleId")
    int deleteBySubjectIdAndScheduleId(@Param("subjectId") String subjectId, @Param("scheduleId") Long scheduleId);
}

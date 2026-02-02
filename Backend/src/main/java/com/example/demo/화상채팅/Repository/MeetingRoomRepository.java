package com.example.demo.화상채팅.Repository;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MeetingRoomRepository extends JpaRepository<MeetingRoom, MeetingRoomId> {

    boolean existsByIdRoomId(String roomId);

    Optional<MeetingRoom> findByIdRoomId(String roomId);

    /** 일정 삭제 전 해당 일정을 참조하는 방 목록 조회 */
    List<MeetingRoom> findBySubjectIdAndScheduleId(String subjectId, Long scheduleId);

    /** 일정 삭제 전 해당 (subject_id, schedule_id)를 참조하는 meeting_room 행 직접 삭제 (FK 제약 회피) */
    @Modifying
    @Query(value = "DELETE FROM meeting_room WHERE subject_id = :subjectId AND schedule_id = :scheduleId", nativeQuery = true)
    int deleteBySubjectIdAndScheduleId(@Param("subjectId") String subjectId, @Param("scheduleId") Long scheduleId);
}

package com.example.demo.화상채팅.Service;

public interface MeetingRoomService {
    String getRoomIdBySubjectId(String subjectId);

    /** 오늘 회차 schedule_id(BIGINT) 조회/생성. 없으면 study_schedule에 1회차 생성 후 반환. */
    Long getOrCreateTodayScheduleId(String subjectId);

    /**
     * 입장 처리 (호스트 → meeting_room, 참여자 → meetingroom_participant)
     * @param scheduleId study_schedule.schedule_id. null이면 오늘 회차 조회/생성 시도.
     */
    void handleJoin(String roomId, String userEmail, String title, boolean isHost,
                    String subjectId, Long scheduleId);

    /**
     * 퇴장 처리
     * - 호스트 → meeting_room.ended_at 업데이트
     * - 참여자 → meetingroom_participant.left_at 업데이트
     */
    void handleLeave(String roomId, String userEmail, boolean isHost);
}

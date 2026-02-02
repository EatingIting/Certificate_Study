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

    /** 강퇴 시 해당 방·오늘 기준으로 기록 (재입장 차단용) */
    void recordKicked(String roomId, String userEmail);

    /** 오늘 이 방에서 강퇴된 유저인지 여부 */
    boolean isKickedToday(String roomId, String userEmail);

    /**
     * 같은 날 다음 회차로 넘어갔을 때, 방에 그대로 남아 있는 참가자를
     * 새 회차(meetingroom_participant)에 자동 배정한다.
     *
     * @param roomId    화상회의 방 ID
     * @param userEmail 참가자 이메일
     */
    void checkAndAssignNewSessionIfNeeded(String roomId, String userEmail);
}

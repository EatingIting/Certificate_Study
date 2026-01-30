package com.example.demo.화상채팅.Service;

public interface MeetingRoomService {
    String getRoomIdBySubjectId(String subjectId);

    /**
     * 입장 처리
     * - 호스트 → meeting_room 테이블에만 저장
     * - 참여자 → participant 테이블에만 저장
     */
    void handleJoin(String roomId, String userEmail, String title, boolean isHost);

    /**
     * 퇴장 처리
     * - 호스트 → meeting_room 테이블의 ended_at 업데이트
     * - 참여자 → participant 테이블의 left_at 업데이트
     */
    void handleLeave(String roomId, String userEmail, boolean isHost);
}

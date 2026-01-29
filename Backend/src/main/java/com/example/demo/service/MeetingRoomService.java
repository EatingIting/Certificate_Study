package com.example.demo.service;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipantId;
import com.example.demo.화상채팅.Repository.MeetingRoomParticipantRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Transactional
public class MeetingRoomService {

    private final MeetingRoomRepository meetingRoomRepository;
    private final MeetingRoomParticipantRepository participantRepository;

    /**
     * 입장 처리
     * - 호스트 → meeting_room 테이블에만 저장
     * - 참여자 → participant 테이블에만 저장
     */
    public void handleJoin(String roomId, String userEmail, String title, boolean isHost) {
        System.out.println("🔵 [MeetingRoomService] handleJoin 호출");
        System.out.println("   roomId: " + roomId);
        System.out.println("   userEmail: " + userEmail);
        System.out.println("   title: " + title);
        System.out.println("   isHost: " + isHost);

        // userEmail이 null이거나 빈값이면 저장하지 않음
        if (userEmail == null || userEmail.isBlank()) {
            System.out.println("⚠️ userEmail이 null 또는 빈값입니다. 저장하지 않습니다.");
            return;
        }

        if (isHost) {
            // 호스트는 meeting_room 테이블에만 저장
            MeetingRoomId id = new MeetingRoomId(roomId, userEmail);
            var existingRoom = meetingRoomRepository.findById(id);

            if (existingRoom.isEmpty()) {
                System.out.println("✅ 호스트 - meeting_room에 저장 시도");
                MeetingRoom room = new MeetingRoom(roomId, userEmail, title);
                meetingRoomRepository.save(room);
                System.out.println("✅ meeting_room 저장 완료");
            } else {
                // 재입장: ended_at을 null로 초기화
                MeetingRoom room = existingRoom.get();
                room.rejoin();
                meetingRoomRepository.save(room);
                System.out.println("⚠️ 재입장 - ended_at 초기화 (created_at 유지)");
            }
        } else {
            // 참여자는 participant 테이블에만 저장
            System.out.println("✅ 참여자 - participant에 저장 시도");
            insertParticipantIfNeeded(roomId, userEmail);
        }
    }

    private void insertParticipantIfNeeded(String roomId, String userEmail) {
        MeetingRoomParticipantId id = new MeetingRoomParticipantId(roomId, userEmail);
        var existingParticipant = participantRepository.findById(id);

        if (existingParticipant.isEmpty()) {
            MeetingRoomParticipant participant =
                    new MeetingRoomParticipant(roomId, userEmail);
            participantRepository.save(participant);
            System.out.println("✅ participant 저장 완료");
        } else {
            // 재입장: left_at을 null로 초기화
            MeetingRoomParticipant participant = existingParticipant.get();
            participant.rejoin();
            participantRepository.save(participant);
            System.out.println("⚠️ 재입장 - left_at 초기화 (joined_at 유지)");
        }
    }

    /**
     * 퇴장 처리
     * - 호스트 → meeting_room 테이블의 ended_at 업데이트
     * - 참여자 → participant 테이블의 left_at 업데이트
     */
    public void handleLeave(String roomId, String userEmail, boolean isHost) {
        System.out.println("🔴 [MeetingRoomService] handleLeave 호출");
        System.out.println("   roomId: " + roomId);
        System.out.println("   userEmail: " + userEmail);
        System.out.println("   isHost: " + isHost);

        if (userEmail == null || userEmail.isBlank()) {
            System.out.println("⚠️ userEmail이 null 또는 빈값입니다. 업데이트하지 않습니다.");
            return;
        }

        if (isHost) {
            MeetingRoomId id = new MeetingRoomId(roomId, userEmail);
            var existingRoom = meetingRoomRepository.findById(id);

            if (existingRoom.isPresent()) {
                MeetingRoom room = existingRoom.get();
                room.endMeeting();
                meetingRoomRepository.save(room);
                System.out.println("✅ meeting_room ended_at 업데이트 완료");
            } else {
                System.out.println("⚠️ 해당 방을 찾을 수 없습니다.");
            }
        } else {
            MeetingRoomParticipantId id = new MeetingRoomParticipantId(roomId, userEmail);
            var existingParticipant = participantRepository.findById(id);

            if (existingParticipant.isPresent()) {
                MeetingRoomParticipant participant = existingParticipant.get();
                participant.leave();
                participantRepository.save(participant);
                System.out.println("✅ participant left_at 업데이트 완료");
            } else {
                System.out.println("⚠️ 해당 참여자를 찾을 수 없습니다.");
            }
        }
    }
}

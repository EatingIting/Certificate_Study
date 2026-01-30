package com.example.demo.화상채팅.Service;

import com.example.demo.화상채팅.Domain.MeetingRoom;
import com.example.demo.화상채팅.Domain.MeetingRoomId;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipantId;
import com.example.demo.화상채팅.Repository.MeetingRoomParticipantRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MeetingRoomServiceImpl implements MeetingRoomService {

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final MeetingRoomRepository meetingRoomRepository;
    private final MeetingRoomParticipantRepository participantRepository;

    @Override
    public String getRoomIdBySubjectId(String subjectId) {
        if (subjectId == null || subjectId.trim().isEmpty()) {
            log.warn("[MeetingRoomServiceImpl] subjectId가 null이거나 비어있습니다.");
            throw new IllegalArgumentException("subjectId는 필수입니다.");
        }

        try {
            // 날짜마다 다른 방: 같은 subjectId + 같은 날짜 → 같은 roomId, 내일이면 다른 roomId
            LocalDate today = LocalDate.now();
            String dateStr = today.toString(); // "2026-01-29"
            String seed = subjectId.trim() + "_" + dateStr;

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(seed.getBytes(StandardCharsets.UTF_8));

            StringBuilder roomId = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                int index = (hash[i % hash.length] & 0xFF) % CHARACTERS.length();
                if (index < 0) index += CHARACTERS.length();
                roomId.append(CHARACTERS.charAt(index));
            }

            String result = roomId.toString();
            log.debug("[MeetingRoomServiceImpl] subjectId={}, date={} -> roomId={}", subjectId, dateStr, result);
            return result;
        } catch (NoSuchAlgorithmException e) {
            log.error("[MeetingRoomServiceImpl] SHA-256 알고리즘을 찾을 수 없습니다.", e);
            throw new RuntimeException("SHA-256 알고리즘을 찾을 수 없습니다.", e);
        }
    }

    @Override
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

    @Override
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

package com.example.demo.service;

import com.example.demo.domain.MeetingRoom;
import com.example.demo.domain.MeetingRoomParticipant;
import com.example.demo.repository.MeetingRoomParticipantRepository;
import com.example.demo.repository.MeetingRoomRepository;
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
     * 최초 입장자 처리
     */
    public void handleFirstJoin(String roomId, String userId, String title) {
        if (!meetingRoomRepository.existsById(roomId)) {
            MeetingRoom room = new MeetingRoom(roomId, userId, title);
            meetingRoomRepository.save(room);
        }

        insertParticipantIfNeeded(roomId, userId);
    }

    /**
     * 이후 입장자 처리
     */
    public void handleJoin(String roomId, String userId) {
        insertParticipantIfNeeded(roomId, userId);
    }

    private void insertParticipantIfNeeded(String roomId, String userId) {

        boolean alreadyJoined =
                participantRepository
                        .findByRoomIdAndUserIdAndLeftAtIsNull(roomId, userId)
                        .isPresent();

        if (alreadyJoined) {
            // 재접속 or 이미 입장 중 → INSERT 안 함
            return;
        }

        MeetingRoomParticipant participant =
                new MeetingRoomParticipant(roomId, userId);

        participantRepository.save(participant);
    }
}
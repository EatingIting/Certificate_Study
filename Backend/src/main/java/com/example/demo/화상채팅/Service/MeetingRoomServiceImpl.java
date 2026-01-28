package com.example.demo.화상채팅.Service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

@Slf4j
@Service
public class MeetingRoomServiceImpl implements MeetingRoomService {

    @Override
    public String getRoomIdBySubjectId(String subjectId) {
        if (subjectId == null || subjectId.trim().isEmpty()) {
            log.warn("[MeetingRoomServiceImpl] subjectId가 null이거나 비어있습니다.");
            throw new IllegalArgumentException("subjectId는 필수입니다.");
        }

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(subjectId.getBytes(StandardCharsets.UTF_8));

            long msb = 0;
            long lsb = 0;
            for (int i = 0; i < 8; i++) {
                msb = (msb << 8) | (hash[i] & 0xff);
            }
            for (int i = 8; i < 16; i++) {
                lsb = (lsb << 8) | (hash[i] & 0xff);
            }

            msb = (msb & 0xffffffffffff0fffL) | 0x4000L; // 버전 4
            lsb = (lsb & 0x3fffffffffffffffL) | 0x8000000000000000L; // variant

            UUID uuid = new UUID(msb, lsb);
            String roomId = uuid.toString();
            
            log.debug("[MeetingRoomServiceImpl] subjectId={} -> roomId={}", subjectId, roomId);
            return roomId;
        } catch (NoSuchAlgorithmException e) {
            log.error("[MeetingRoomServiceImpl] SHA-256 알고리즘을 찾을 수 없습니다.", e);
            throw new RuntimeException("SHA-256 알고리즘을 찾을 수 없습니다.", e);
        }
    }
}
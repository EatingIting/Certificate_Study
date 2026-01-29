package com.example.demo.화상채팅.Service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;

@Slf4j
@Service
public class MeetingRoomServiceImpl implements MeetingRoomService {

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

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
}
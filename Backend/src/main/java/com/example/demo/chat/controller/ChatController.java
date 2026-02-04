package com.example.demo.chat.controller;

import com.example.demo.chat.entity.ChatMessage;
import com.example.demo.chat.repository.ChatMessageRepository;
import com.example.demo.LMS회원.Repository.RoomJoinRequestRepository;
import com.example.demo.LMS회원.Repository.UserRepository;
import com.example.demo.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j; // 로그용
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@Slf4j // 로그 출력 기능 추가
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatMessageRepository chatMessageRepository;
    private final RoomJoinRequestRepository roomJoinRequestRepository;
    private final UserRepository userRepository;

    @GetMapping("/rooms/{roomId}/messages")
    public List<ChatMessage> getChatMessages(@PathVariable String roomId) {
        return chatMessageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
    }

    /**
     * 🏷️ 닉네임 가져오기 (디버깅 로그 추가됨)
     */
    @GetMapping("/rooms/{roomId}/nickname")
    public ResponseEntity<String> getRoomNickname(
            @PathVariable String roomId,
            @AuthenticationPrincipal String email
    ) {
        log.info("🔍 닉네임 조회 요청 - 방ID: {}, 이메일: {}", roomId, email);

        // 1. [참가자 체크] 신청자 명단에서 닉네임 찾기
        Optional<String> nicknameOpt = roomJoinRequestRepository.findNicknameByRoomIdAndEmail(roomId, email);

        if (nicknameOpt.isPresent()) {
            log.info("✅ 참가자 닉네임 발견: {}", nicknameOpt.get());
            return ResponseEntity.ok(nicknameOpt.get());
        }

        // 2. [방장 체크] 만약 신청자가 아니라면, 혹시 방장인가? (Users 테이블 조회)
        // (방장은 신청서가 없으므로 본명을 쓰거나, 별도 로직 필요)
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("유저 정보 없음"));

        log.info("⚠️ 신청 내역 없음. 기본 이름 반환: {}", user.getName());
        return ResponseEntity.ok(user.getName()); // 기본 이름 반환
    }
}
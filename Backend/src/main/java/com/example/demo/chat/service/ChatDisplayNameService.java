package com.example.demo.chat.service;

import com.example.demo.LMS회원.Repository.UserRepository;
import com.example.demo.entity.User;
import com.example.demo.roommypage.RoomMyPageMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 출석부/헤더와 동일한 표시명 로직 (방별 닉네임 우선 → 전역 닉네임 → 이름).
 * Host+Member 동일 계정 시 방별 닉네임이 일관되게 적용되도록 함.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatDisplayNameService {

    private final UserRepository userRepository;
    private final RoomMyPageMapper roomMyPageMapper;

    /**
     * roomId + userId로 표시명 반환. 출석부·LMSContext displayName과 동일 규칙.
     */
    public String getDisplayName(String roomId, String userId) {
        if (roomId == null || userId == null || userId.length() < 30) {
            return null;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return null;
        }

        String email = user.getEmail();
        String name = trim(user.getName());
        String nickname = trim(user.getNickname());

        // 출석부와 동일: 방별 닉네임 (방장=hostUserNickname, 승인멤버=request_user_nickname)
        String roomNick = roomMyPageMapper.selectRoomNicknameOptional(roomId, email);
        roomNick = trim(roomNick);

        // 닉네임만 표시 (괄호 실명 없음), LMSContext displayName과 동일
        if (roomNick != null && !roomNick.isEmpty()) {
            return roomNick;
        }
        if (nickname != null && !nickname.isEmpty()) {
            return nickname;
        }
        if (name != null && !name.isEmpty()) {
            return name;
        }
        return "사용자";
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}

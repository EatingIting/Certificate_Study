package com.example.demo.roomprofile;

import com.example.demo.roomprofile.RoomNicknameMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RoomNicknameServiceImpl implements RoomNicknameService {

    private final RoomNicknameMapper roomNicknameMapper;

    @Override
    public String getMyNickname(String roomId, String userEmail) {
        String nickname = roomNicknameMapper.selectMyNickname(roomId, userEmail);
        if (nickname == null) {
            throw new IllegalArgumentException("승인된 멤버만 조회할 수 있습니다.");
        }
        return nickname;
    }

    @Override
    @Transactional
    public String updateMyNickname(String roomId, String userEmail, String nickname) {
        int dup = roomNicknameMapper.countNicknameDup(roomId, nickname, userEmail);
        if (dup > 0) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        int updated = roomNicknameMapper.updateMyNickname(roomId, userEmail, nickname);
        if (updated == 0) {
            throw new IllegalArgumentException("승인된 멤버만 변경할 수 있습니다.");
        }
        return nickname;
    }
}
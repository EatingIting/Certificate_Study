package com.example.demo.roomprofile;

import com.example.demo.roomprofile.RoomNicknameResponse;
import com.example.demo.roomprofile.RoomNicknameUpdateRequest;
import com.example.demo.roomprofile.RoomNicknameService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms")
public class RoomNicknameController {

    private final RoomNicknameService roomNicknameService;

    @GetMapping("/{roomId}/me/nickname")
    public RoomNicknameResponse getMyNickname(@PathVariable String roomId) {
        String email = getCurrentUserEmail();
        String nickname = roomNicknameService.getMyNickname(roomId, email);
        return new RoomNicknameResponse(nickname);
    }

    @PatchMapping("/{roomId}/me/nickname")
    public RoomNicknameResponse updateMyNickname(
            @PathVariable String roomId,
            @Valid @RequestBody RoomNicknameUpdateRequest request
    ) {
        String email = getCurrentUserEmail();
        String nickname = roomNicknameService.updateMyNickname(roomId, email, request.getNickname());
        return new RoomNicknameResponse(nickname);
    }

    private String getCurrentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("인증 정보가 없습니다.");
        }
        return auth.getName(); // 프로젝트에 따라 email이 아닐 수도 있음
    }
}
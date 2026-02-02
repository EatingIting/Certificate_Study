package com.example.demo.roommypage;

import com.example.demo.roommypage.dto.RoomMyPageResponse;
import com.example.demo.roommypage.dto.RoomNicknameUpdateRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms/{roomId}/me")
public class RoomMyPageController {

    private final RoomMyPageService roomMyPageService;

    @GetMapping("/mypage")
    public RoomMyPageResponse getMyPage(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new IllegalArgumentException("인증 정보가 없습니다.");
        }
        String principal = authentication.getName(); // email or userId(UUID)
        return roomMyPageService.getRoomMyPage(roomId, principal);
    }

    @PatchMapping("/nickname")
    public RoomMyPageResponse updateRoomNickname(
            @PathVariable String roomId,
            @Valid @RequestBody RoomNicknameUpdateRequest request,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new IllegalArgumentException("인증 정보가 없습니다.");
        }
        String principal = authentication.getName(); // email or userId(UUID)
        return roomMyPageService.updateRoomNickname(roomId, principal, request.getRoomNickname());
    }
}
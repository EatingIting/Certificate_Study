package com.example.demo.roommypage;

import com.example.demo.roommypage.dto.MyRoomItem;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/me")
public class MyRoomsController {

    private final RoomMyPageService roomMyPageService;

    @GetMapping("/rooms")
    public List<MyRoomItem> getMyRooms(Authentication authentication) {
        if (authentication == null) {
            throw new IllegalArgumentException("인증 정보가 없습니다.");
        }
        String principal = authentication.getName(); // email or userId(UUID)
        return roomMyPageService.getMyRooms(principal);
    }
}

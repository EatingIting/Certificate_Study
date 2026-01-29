package com.example.demo.roomcontext;

import com.example.demo.dto.roomcontext.RoomContextResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms")
public class RoomContextController {

    private final RoomContextService roomContextService;

    @GetMapping("/{roomId}/context")
    public RoomContextResponse getContext(@PathVariable String roomId) {
        return roomContextService.getRoomContext(roomId);
    }
}

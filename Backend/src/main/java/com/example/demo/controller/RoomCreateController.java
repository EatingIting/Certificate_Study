package com.example.demo.controller;

import com.example.demo.roomcreate.RoomCreateRequest;
import com.example.demo.roomcreate.RoomCreateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomCreateController {

    private final RoomCreateService roomService;

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<Void> createRoom(
            @ModelAttribute RoomCreateRequest request,
            Authentication authentication
    ) {
        roomService.insertRoom(request, authentication.getName());
        return ResponseEntity.ok().build();
    }

    @PutMapping(value = "/{roomId}", consumes = "multipart/form-data")
    public ResponseEntity<Void> updateRoom(
            @PathVariable String roomId,
            @ModelAttribute RoomCreateRequest request,
            Authentication authentication
    ) {
        roomService.updateRoom(roomId, request, authentication.getName());
        return ResponseEntity.ok().build();
    }
}

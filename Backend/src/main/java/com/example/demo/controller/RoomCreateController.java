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

    @PostMapping
    public ResponseEntity<Void> createRoom(
            @RequestBody RoomCreateRequest request,
            Authentication authentication
    ) {
        roomService.insertRoom(request, authentication.getName());
        return ResponseEntity.ok().build();
    }
}

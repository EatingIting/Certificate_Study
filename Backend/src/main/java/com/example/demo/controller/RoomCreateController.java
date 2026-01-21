package com.example.demo.controller;

import com.example.demo.roomcreate.RoomCreateRequest;
import com.example.demo.roomcreate.RoomCreateService;
import com.example.demo.roomcreate.RoomCreateVO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomCreateController {

    private final RoomCreateService roomService;

    @PostMapping
    public ResponseEntity<Void> createRoom(
            @RequestBody RoomCreateRequest request,
            @AuthenticationPrincipal String userId
    ) {

        roomService.createRoom(request, userId);
        return ResponseEntity.ok().build();
    }

}

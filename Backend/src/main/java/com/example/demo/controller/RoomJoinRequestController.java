package com.example.demo.controller;

import com.example.demo.roomjoinrequest.RoomJoinRequestService;
import com.example.demo.roomjoinrequest.RoomJoinRequestVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/room-join-requests")
public class RoomJoinRequestController {

    private final RoomJoinRequestService service;

    @PostMapping
    public void apply(
            @RequestBody RoomJoinRequestVO vo,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        vo.setRequestUserEmail(userEmail);
        service.apply(vo);
    }

    @GetMapping("/sent")
    public List<RoomJoinRequestVO> sent(Authentication authentication) {
        return service.getSent(authentication.getName());
    }

    @GetMapping("/received")
    public List<RoomJoinRequestVO> received(Authentication authentication) {
        return service.getReceived(authentication.getName());
    }

    @PatchMapping("/{joinId}")
    public void update(
            @PathVariable String joinId,
            @RequestParam String status
    ) {
        RoomJoinRequestVO vo = new RoomJoinRequestVO();
        vo.setJoinId(joinId);
        vo.setStatus(status);
        service.updateStatus(vo);
    }
}

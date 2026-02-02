package com.example.demo.모집.controller;

import com.example.demo.모집.mapper.UserMapper;
import com.example.demo.모집.service.RoomJoinRequestService;
import com.example.demo.모집.vo.RoomJoinRequestVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/room-join-requests")
public class RoomJoinRequestController {

    private final RoomJoinRequestService service;
    private final UserMapper userMapper;

    @PostMapping
    public void apply(
            @RequestBody RoomJoinRequestVO vo,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();

        vo.setRequestUserEmail(userEmail);

        String nickname = userMapper.findNicknameByEmail(userEmail);
        vo.setNickname(nickname);

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

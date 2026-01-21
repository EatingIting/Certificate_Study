package com.example.demo.controller;

import com.example.demo.roomjoinrequest.RoomJoinRequestService;
import com.example.demo.roomjoinrequest.RoomJoinRequestVO;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/room-join-requests")
public class RoomJoinRequestController {

    private final RoomJoinRequestService service;

    // 신청
    @PostMapping
    public void apply(
            @RequestBody RoomJoinRequestVO vo,
            HttpSession session
    ) {
        // 로그인한 유저 ID
        String loginUserId = (String) session.getAttribute("userId");

        vo.setRequestUserId(loginUserId); // 신청자
        service.apply(vo);
    }


    // 내가 신청한 스터디
    @GetMapping("/sent")
    public List<RoomJoinRequestVO> sent(HttpSession session) {
        String userId = (String) session.getAttribute("userId");
        return service.getSent(userId);
    }

    // 내가 받은 신청
    @GetMapping("/received")
    public List<RoomJoinRequestVO> received(HttpSession session) {
        String userId = (String) session.getAttribute("userId");
        return service.getReceived(userId);
    }

    // 승인 / 거절
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
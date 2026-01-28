package com.example.demo.controller;

import com.example.demo.dto.roomparticipant.*;
import com.example.demo.service.roomparticipant.RoomParticipantService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms")
public class RoomParticipantController {

    private final RoomParticipantService service;

    // ✅ 스터디원 목록(방장만)
    @GetMapping("/{roomId}/participants")
    public RoomParticipantListResponse getParticipants(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        String myEmail = authentication.getName();
        return service.getParticipants(roomId, myEmail);
    }

    // ✅ 강퇴(방장만)
    @DeleteMapping("/{roomId}/participants")
    public ActionResultResponse kickParticipant(
            @PathVariable String roomId,
            @RequestBody KickMemberRequest request,
            Authentication authentication
    ) {
        String myEmail = authentication.getName();
        return service.kickParticipant(roomId, myEmail, request);
    }

    // ✅ 방장 위임(방장만)
    @PatchMapping("/{roomId}/participants/owner")
    public ActionResultResponse transferOwner(
            @PathVariable String roomId,
            @RequestBody TransferOwnerRequest request,
            Authentication authentication
    ) {
        String myEmail = authentication.getName();
        return service.transferOwner(roomId, myEmail, request);
    }

    // ✅ 탈퇴(본인) - DTO 없이 처리
    @DeleteMapping("/{roomId}/participants/me")
    public ActionResultResponse leaveRoom(
            @PathVariable String roomId,
            Authentication authentication
    ) {
        String myEmail = authentication.getName();
        return service.leaveRoom(roomId, myEmail);
    }
}

package com.example.demo.controller;

import com.example.demo.application.ApplicationService;
import com.example.demo.application.ApplicationVO;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping
    public void applyToRoom(
            @AuthenticationPrincipal String requestUserId,
            @RequestBody ApplicationVO applicationVO
    ) {
        applicationService.applyToRoom(
                requestUserId,
                applicationVO.getRoomId(),
                applicationVO.getApplyMessage()
        );
    }

    // ===============================
    // 신청 받은 스터디 (방장 기준)
    // ===============================
    @GetMapping("/received")
    public List<ApplicationVO> getReceivedApplications(
            @AuthenticationPrincipal String ownerUserId
    ) {
        return applicationService.getReceivedApplications(ownerUserId);
    }

    // ===============================
    // 내가 신청한 스터디 (신청자 기준)
    // ===============================
    @GetMapping("/sent")
    public List<ApplicationVO> getSentApplications(
            @AuthenticationPrincipal String requestUserId
    ) {
        return applicationService.getSentApplications(requestUserId);
    }

    // ===============================
    // 승인
    // ===============================
    @PostMapping("/{joinId}/approve")
    public void approveApplication(
            @PathVariable String joinId,
            @AuthenticationPrincipal String ownerUserId
    ) {
        applicationService.approveApplication(joinId, ownerUserId);
    }

    // ===============================
    // 거절
    // ===============================
    @PostMapping("/{joinId}/reject")
    public void rejectApplication(
            @PathVariable String joinId,
            @AuthenticationPrincipal String ownerUserId
    ) {
        applicationService.rejectApplication(joinId, ownerUserId);
    }
}


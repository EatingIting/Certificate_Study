package com.example.demo.controller;

import com.example.demo.application.ApplicationService;
import com.example.demo.application.ApplicationVO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/applications")
public class ApplicationController {

    private final ApplicationService applicationService;

    @PostMapping
    public void applyToRoom(
            Authentication authentication,
            @RequestBody ApplicationVO applicationVO
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        try {
            applicationService.applyToRoom(
                    authentication.getName(),
                    applicationVO.getRequestUserNickname(),
                    applicationVO.getRoomId(),
                    applicationVO.getApplyMessage()
            );
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    e.getMessage()
            );
        }
    }


    @GetMapping("/received")
    public List<ApplicationVO> getReceivedApplications(
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }
        String hostUserEmail = authentication.getName();
        return applicationService.getReceivedApplications(hostUserEmail);
    }

    @GetMapping("/sent")
    public List<ApplicationVO> getSentApplications(
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }
        String requestUserEmail = authentication.getName();
        return applicationService.getSentApplications(requestUserEmail);
    }

    @PostMapping("/{joinId}/approve")
    public void approveApplication(
            @PathVariable String joinId,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        String hostUserEmail = authentication.getName();
        applicationService.approveApplication(joinId, hostUserEmail);
    }

    @PostMapping("/{joinId}/reject")
    public void rejectApplication(
            @PathVariable String joinId,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        String hostUserEmail = authentication.getName();
        applicationService.rejectApplication(joinId, hostUserEmail);
    }
}

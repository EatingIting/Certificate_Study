package com.example.demo.모집.controller;

import com.example.demo.모집.service.ApplicationService;
import com.example.demo.모집.vo.ApplicationVO;
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


    // 신청하기
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


    // 신청 받은 목록
    @GetMapping("/received")
    public List<ApplicationVO> getReceivedApplications(
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        return applicationService.getReceivedApplications(authentication.getName());
    }


    // 내가 신청한 목록
    @GetMapping("/sent")
    public List<ApplicationVO> getSentApplications(
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        return applicationService.getSentApplications(authentication.getName());
    }


    // 승인
    @PostMapping("/{joinId}/approve")
    public void approveApplication(
            @PathVariable String joinId,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        try {
            applicationService.approveApplication(
                    joinId,
                    authentication.getName()
            );

        } catch (IllegalStateException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    e.getMessage()
            );
        }
    }


    // 거절
    @PostMapping("/{joinId}/reject")
    public void rejectApplication(
            @PathVariable String joinId,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }

        applicationService.rejectApplication(
                joinId,
                authentication.getName()
        );
    }
}

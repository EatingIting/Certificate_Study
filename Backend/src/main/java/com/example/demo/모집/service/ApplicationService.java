package com.example.demo.모집.service;

import com.example.demo.모집.vo.ApplicationVO;

import java.util.List;

public interface ApplicationService {

    List<ApplicationVO> getReceivedApplications(String hostUserEmail);

    List<ApplicationVO> getSentApplications(String requestUserEmail);

    void approveApplication(String joinId, String hostUserEmail);

    void rejectApplication(String joinId, String hostUserEmail);

    void applyToRoom(
            String requestUserEmail,
            String requestUserNickname,
            String roomId,
            String applyMessage
    );
}

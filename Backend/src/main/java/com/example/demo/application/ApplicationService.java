package com.example.demo.application;

import java.util.List;

public interface ApplicationService {

    List<ApplicationVO> getReceivedApplications(String ownerUserId);

    List<ApplicationVO> getSentApplications(String requestUserId);

    void approveApplication(String joinId, String ownerUserId);

    void rejectApplication(String joinId, String ownerUserId);

    void applyToRoom(String requestUserId, String roomId, String applyMessage);
}

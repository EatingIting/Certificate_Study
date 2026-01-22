package com.example.demo.application;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ApplicationServiceImpl implements ApplicationService {

    private final ApplicationMapper applicationMapper;

    public ApplicationServiceImpl(ApplicationMapper applicationMapper) {
        this.applicationMapper = applicationMapper;
    }

    @Override
    public List<ApplicationVO> getReceivedApplications(String ownerUserId) {
        return applicationMapper.selectReceivedApplications(ownerUserId);
    }

    @Override
    public List<ApplicationVO> getSentApplications(String requestUserId) {
        return applicationMapper.selectSentApplications(requestUserId);
    }

    @Override
    public void approveApplication(String joinId, String ownerUserId) {
        applicationMapper.approveApplication(joinId, ownerUserId);
    }

    @Override
    public void rejectApplication(String joinId, String ownerUserId) {
        applicationMapper.rejectApplication(joinId, ownerUserId);
    }

    @Override
    public void applyToRoom(String requestUserId, String roomId, String applyMessage) {
        applicationMapper.insertApplication(
                UUID.randomUUID().toString(),
                requestUserId,
                roomId,
                applyMessage
        );
    }
}

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
    public List<ApplicationVO> getReceivedApplications(String hostUserEmail) {
        return applicationMapper.selectReceivedApplications(hostUserEmail);
    }

    @Override
    public List<ApplicationVO> getSentApplications(String requestUserEmail) {
        return applicationMapper.selectSentApplications(requestUserEmail);
    }

    @Override
    public void approveApplication(String joinId, String hostUserEmail) {
        applicationMapper.approveApplication(joinId, hostUserEmail);
    }

    @Override
    public void rejectApplication(String joinId, String hostUserEmail) {
        applicationMapper.rejectApplication(joinId, hostUserEmail);
    }

    @Override
    public void applyToRoom(
            String requestUserEmail,
            String requestUserNickname,
            String roomId,
            String applyMessage
    ) {
        int exists = applicationMapper.existsActiveApplication(roomId, requestUserEmail);

        if (exists > 0) {
            throw new IllegalStateException("이미 신청 중이거나 승인된 스터디입니다.");
        }

        int result = applicationMapper.insertApplication(
                UUID.randomUUID().toString(),
                requestUserEmail,
                requestUserNickname,
                roomId,
                applyMessage
        );

        // ✅ 본인이 만든 방이면 insert가 안 되므로 result == 0
        if (result == 0) {
            throw new IllegalStateException("본인이 작성한 스터디에는 신청할 수 없습니다.");
        }
    }


}

package com.example.demo.모집.service;

import com.example.demo.모집.mapper.ApplicationMapper;
import com.example.demo.모집.vo.ApplicationVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    @Transactional
    public void approveApplication(String joinId, String hostUserEmail) {

        String roomId = applicationMapper.getRoomIdByJoinId(joinId);

        int approvedCount = applicationMapper.countApprovedByRoomId(roomId);
        int maxParticipants = applicationMapper.getMaxParticipants(roomId);

        // ✅ 방장 제외 모집 가능 인원
        int recruitLimit = maxParticipants - 1;

        // 정원 초과 시 승인 불가
        if (approvedCount >= recruitLimit) {
            throw new IllegalStateException("정원이 초과되어 승인할 수 없습니다.");
        }

        // 승인 처리
        applicationMapper.approveApplication(joinId, hostUserEmail);

        // 승인 후 다시 count
        approvedCount = applicationMapper.countApprovedByRoomId(roomId);

        // 정원 꽉 차면 CLOSED + 신청중 자동 거절
        if (approvedCount == recruitLimit) {
            applicationMapper.closeRoom(roomId);
            applicationMapper.autoRejectPending(roomId);
        }
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
            String applyMessage) {

        // 성별 제한 검사
        String userGender = applicationMapper.getUserGender(requestUserEmail);

        String roomGender = applicationMapper.getRoomGender(roomId);

        if (!roomGender.equals("ALL") && !roomGender.equals(userGender)) {
            throw new IllegalStateException("성별 제한으로 신청할 수 없습니다.");
        }

        // 현재 신청 상태 조회
        String status = applicationMapper.findStatus(roomId, requestUserEmail);

        // 신청한 적 없음 → insert
        if (status == null) {

            int result = applicationMapper.insertApplication(
                    UUID.randomUUID().toString(),
                    requestUserEmail,
                    requestUserNickname,
                    roomId,
                    applyMessage);

            if (result == 0) {
                throw new IllegalStateException("본인이 작성한 스터디에는 신청할 수 없습니다.");
            }

            return;
        }

        // 거절 상태면 → update로 재신청
        if ("거절".equals(status)) {

            applicationMapper.reapply(
                    roomId,
                    requestUserEmail,
                    applyMessage);

            return;
        }

        // 신청중 또는 승인 상태면 재신청 불가
        throw new IllegalStateException("이미 신청 중이거나 승인된 스터디입니다.");
    }

}

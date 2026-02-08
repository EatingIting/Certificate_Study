package com.example.demo.모집.service;

import com.example.demo.모집.handler.NotificationWebSocketHandler;
import com.example.demo.모집.mapper.ApplicationMapper;
import com.example.demo.모집.mapper.UserMapper;
import com.example.demo.모집.vo.ApplicationVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ApplicationServiceImpl implements ApplicationService {

    private final ApplicationMapper applicationMapper;

    // 방장 알림 WebSocket
    private final NotificationWebSocketHandler notificationHandler;

    // hostEmail → hostUserId 변환용
    private final UserMapper userMapper;

    public ApplicationServiceImpl(
            ApplicationMapper applicationMapper,
            NotificationWebSocketHandler notificationHandler,
            UserMapper userMapper
    ) {
        this.applicationMapper = applicationMapper;
        this.notificationHandler = notificationHandler;
        this.userMapper = userMapper;
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

        String requestUserEmail =
                applicationMapper.getRequestUserEmailByJoinId(joinId);

        String studyTitle =
                applicationMapper.getStudyTitleByJoinId(joinId);

        String roomId = applicationMapper.getRoomIdByJoinId(joinId);
        if (roomId == null || roomId.isBlank()) {
            throw new IllegalStateException("존재하지 않는 신청입니다.");
        }

        int approvedCount = applicationMapper.countApprovedByRoomId(roomId);
        int maxParticipants = applicationMapper.getMaxParticipants(roomId);

        // 방장 제외 모집 가능 인원
        int recruitLimit = maxParticipants - 1;

        // 정원 초과 시 승인 불가
        if (approvedCount >= recruitLimit) {
            throw new IllegalStateException("정원이 초과되어 승인할 수 없습니다.");
        }

        // 승인 처리
        int updated = applicationMapper.approveApplication(joinId, hostUserEmail);
        if (updated == 0) {
            throw new IllegalStateException("승인할 신청이 없습니다.");
        }

        // 승인 후 다시 count
        approvedCount = applicationMapper.countApprovedByRoomId(roomId);

        // 정원 꽉 차면 CLOSED + 신청중 자동 거절
        if (approvedCount == recruitLimit) {
            applicationMapper.closeRoom(roomId);
            applicationMapper.autoRejectPending(roomId);
        }

        sendDecisionNotificationToApplicant(
                requestUserEmail,
                "APPROVED",
                getStudyTitleText(studyTitle) + " 스터디 가입 신청이 승인되었습니다."
        );
    }

    @Override
    public void rejectApplication(String joinId, String hostUserEmail) {
        String requestUserEmail =
                applicationMapper.getRequestUserEmailByJoinId(joinId);

        String studyTitle =
                applicationMapper.getStudyTitleByJoinId(joinId);

        int updated = applicationMapper.rejectApplication(joinId, hostUserEmail);
        if (updated == 0) {
            throw new IllegalStateException("거절할 신청이 없습니다.");
        }

        sendDecisionNotificationToApplicant(
                requestUserEmail,
                "REJECTED",
                getStudyTitleText(studyTitle) + " 스터디 가입 신청이 거절되었습니다."
        );
    }

    @Override
    public void applyToRoom(
            String requestUserEmail,
            String requestUserNickname,
            String roomId,
            String applyMessage
    ) {

        System.out.println("===== 신청 요청 들어옴 =====");
        System.out.println("신청자 이메일: " + requestUserEmail);
        System.out.println("신청자 닉네임: " + requestUserNickname);
        System.out.println("스터디 roomId: " + roomId);

        String userGender =
                applicationMapper.getUserGender(requestUserEmail);

        String roomGender =
                applicationMapper.getRoomGender(roomId);

        if (!roomGender.equals("ALL") && !roomGender.equals(userGender)) {
            throw new IllegalStateException("성별 제한으로 신청할 수 없습니다.");
        }

        String status =
                applicationMapper.findStatus(roomId, requestUserEmail);

        if (status == null) {

            int result = applicationMapper.insertApplication(
                    UUID.randomUUID().toString(),
                    requestUserEmail,
                    requestUserNickname,
                    roomId,
                    applyMessage
            );

            if (result == 0) {
                throw new IllegalStateException("본인이 작성한 스터디에는 신청할 수 없습니다.");
            }

            System.out.println("신청 DB 저장 완료");

            String hostEmail =
                    applicationMapper.getHostEmailByRoomId(roomId);

            System.out.println("방장 이메일 hostEmail: " + hostEmail);

            String hostUserId =
                    userMapper.findUserIdByEmail(hostEmail);

            System.out.println("방장 userId hostUserId: " + hostUserId);


            if (hostUserId != null) {
                System.out.println("방장에게 WebSocket 알림 전송 시도");

                notificationHandler.sendToOwner(
                        hostUserId,
                        requestUserNickname + " 님이 스터디 신청을 보냈습니다!"
                );
            }

            return;
        }

        if ("거절".equals(status)) {

            applicationMapper.reapply(
                    roomId,
                    requestUserEmail,
                    requestUserNickname,
                    applyMessage
            );

            System.out.println("재신청 DB 업데이트 완료");

            String hostEmail =
                    applicationMapper.getHostEmailByRoomId(roomId);

            String hostUserId =
                    userMapper.findUserIdByEmail(hostEmail);

            System.out.println("재신청 방장 userId: " + hostUserId);

            if (hostUserId != null) {
                notificationHandler.sendToOwner(
                        hostUserId,
                        requestUserNickname + " 님이 다시 신청했습니다!"
                );
            }

            return;
        }

        throw new IllegalStateException("이미 신청 중이거나 승인된 스터디입니다.");
    }

    private void sendDecisionNotificationToApplicant(
            String requestUserEmail,
            String status,
            String content
    ) {
        if (requestUserEmail == null || requestUserEmail.isBlank()) {
            return;
        }

        String requestUserId =
                userMapper.findUserIdByEmail(requestUserEmail);

        if (requestUserId == null || requestUserId.isBlank()) {
            return;
        }

        notificationHandler.sendApplicationDecisionNotification(
                requestUserId,
                status,
                content
        );
    }

    private String getStudyTitleText(String studyTitle) {
        if (studyTitle == null || studyTitle.isBlank()) {
            return "해당";
        }
        return studyTitle;
    }

}

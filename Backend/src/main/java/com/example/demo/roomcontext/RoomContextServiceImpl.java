package com.example.demo.roomcontext;

import com.example.demo.dto.roomcontext.RoomContextResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RoomContextServiceImpl implements RoomContextService {

    private final RoomContextMapper roomContextMapper;
    private final CurrentUserUtil currentUserUtil;

    @Override
    public RoomContextResponse getRoomContext(String roomId) {
        String myEmail = currentUserUtil.getCurrentUserEmail();

        RoomBasicVO room = roomContextMapper.selectRoomBasic(roomId);
        if (room == null) {
            throw new IllegalArgumentException("스터디룸을 찾을 수 없습니다.");
        }

        String myRole;
        String hostEmail = room.getHostUserEmail() != null ? room.getHostUserEmail().trim() : "";
        String myEmailNorm = myEmail != null ? myEmail.trim() : "";

        // 1) 방장인가? (대소문자·공백 무시)
        if (!hostEmail.isEmpty() && hostEmail.equalsIgnoreCase(myEmailNorm)) {
            myRole = "OWNER";
        } else {
            // 2) host가 비어 있으면 대체 방장 1명(승인 멤버 중 1명)과 비교 → 스터디장 권한 복구
            String fallbackHost = "";
            if (hostEmail.isEmpty()) {
                String fallback = roomContextMapper.selectFallbackHostEmail(roomId);
                fallbackHost = fallback != null ? fallback.trim() : "";
            }
            if (!hostEmail.isEmpty()) {
                // host 있음 → 기존: 승인 멤버 여부만
                int approvedCount = roomContextMapper.countApprovedMember(roomId, myEmail);
                myRole = (approvedCount > 0) ? "MEMBER" : "NONE";
            } else if (!fallbackHost.isEmpty() && fallbackHost.equalsIgnoreCase(myEmailNorm)) {
                myRole = "OWNER";
                hostEmail = fallbackHost;
            } else {
                int approvedCount = roomContextMapper.countApprovedMember(roomId, myEmail);
                myRole = (approvedCount > 0) ? "MEMBER" : "NONE";
            }
        }

        // OWNER인데 host_email이 비어 있으면 현재 사용자 이메일로 채움 (스터디장 권한 유지)
        String resolvedHostEmail = !hostEmail.isEmpty() ? hostEmail : ("OWNER".equals(myRole) ? myEmailNorm : "");
        return new RoomContextResponse(room.getRoomId(), room.getTitle(), resolvedHostEmail, myRole);
    }
}
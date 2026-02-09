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
        String deniedReason = null;
        String hostEmail = room.getHostUserEmail() != null ? room.getHostUserEmail().trim() : "";
        String myEmailNorm = myEmail != null ? myEmail.trim() : "";

        if (!hostEmail.isEmpty() && hostEmail.equalsIgnoreCase(myEmailNorm)) {
            myRole = "OWNER";
        } else {
            String fallbackHost = "";
            if (hostEmail.isEmpty()) {
                String fallback = roomContextMapper.selectFallbackHostEmail(roomId);
                fallbackHost = fallback != null ? fallback.trim() : "";
            }

            if (!hostEmail.isEmpty()) {
                int approvedCount = roomContextMapper.countApprovedMember(roomId, myEmail);
                myRole = approvedCount > 0 ? "MEMBER" : "NONE";
            } else if (!fallbackHost.isEmpty() && fallbackHost.equalsIgnoreCase(myEmailNorm)) {
                myRole = "OWNER";
                hostEmail = fallbackHost;
            } else {
                int approvedCount = roomContextMapper.countApprovedMember(roomId, myEmail);
                myRole = approvedCount > 0 ? "MEMBER" : "NONE";
            }
        }

        if ("NONE".equals(myRole)) {
            deniedReason = roomContextMapper.selectLatestLeaveReason(roomId, myEmailNorm);
        }

        String resolvedHostEmail = !hostEmail.isEmpty()
                ? hostEmail
                : ("OWNER".equals(myRole) ? myEmailNorm : "");

        return new RoomContextResponse(
                room.getRoomId(),
                room.getTitle(),
                resolvedHostEmail,
                myRole,
                deniedReason
        );
    }
}

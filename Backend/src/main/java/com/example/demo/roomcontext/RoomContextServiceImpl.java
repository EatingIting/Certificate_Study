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

        // 1) 방장인가?
        if (room.getHostUserEmail() != null && room.getHostUserEmail().equals(myEmail)) {
            myRole = "OWNER";
        } else {
            // 2) 승인 멤버인가?
            int approvedCount = roomContextMapper.countApprovedMember(roomId, myEmail);
            myRole = (approvedCount > 0) ? "MEMBER" : "NONE";
        }

        return new RoomContextResponse(room.getRoomId(), room.getTitle(), myRole);
    }
}
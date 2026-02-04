package com.example.demo.모집.service;

import com.example.demo.모집.handler.NotificationWebSocketHandler;
import com.example.demo.모집.mapper.RoomJoinRequestMapper;
import com.example.demo.모집.mapper.UserMapper;
import com.example.demo.모집.vo.RoomJoinRequestVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomJoinRequestServiceImpl implements RoomJoinRequestService {

    private final RoomJoinRequestMapper mapper;
    private final UserMapper userMapper;
    private final NotificationWebSocketHandler notificationHandler;

    @Override
    public void apply(RoomJoinRequestVO vo) {

        String status = mapper.findStatus(vo.getRequestUserEmail(), vo.getRoomId());

        // 처음 신청
        if (status == null) {

            mapper.insert(vo);

            String hostUserId =
                    userMapper.findUserIdByEmail(vo.getHostUserEmail());

            if (hostUserId != null) {
                notificationHandler.sendToOwner(
                        hostUserId,
                        vo.getNickname() + " 님이 스터디 신청을 보냈습니다!"
                );
            }

            return;
        }

        // 거절된 신청 재신청
        if ("거절".equals(status)) {

            mapper.reapply(vo);

            String hostUserId =
                    userMapper.findUserIdByEmail(vo.getHostUserEmail());

            if (hostUserId != null) {
                notificationHandler.sendToOwner(
                        hostUserId,
                        vo.getNickname() + " 님이 다시 신청했습니다!"
                );
            }

            return;
        }

        throw new RuntimeException("이미 신청한 스터디입니다.");
    }

    @Override
    public List<RoomJoinRequestVO> getSent(String userEmail) {
        return mapper.selectSent(userEmail);
    }

    @Override
    public List<RoomJoinRequestVO> getReceived(String userEmail) {
        return mapper.selectReceived(userEmail);
    }

    @Override
    public void updateStatus(RoomJoinRequestVO vo) {
        mapper.updateStatus(vo);
    }
}
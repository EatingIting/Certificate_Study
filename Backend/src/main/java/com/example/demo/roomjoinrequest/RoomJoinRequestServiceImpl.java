package com.example.demo.roomjoinrequest;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomJoinRequestServiceImpl implements RoomJoinRequestService {

    private final RoomJoinRequestMapper mapper;

    @Override
    public void apply(RoomJoinRequestVO vo) {

        String status = mapper.findStatus(vo.getRequestUserEmail(), vo.getRoomId());

        if (status == null) {
            mapper.insert(vo);
            return;
        }

        if ("거절".equals(status)) {
            mapper.reapply(vo);
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

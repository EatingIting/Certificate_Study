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
        mapper.insert(vo);
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

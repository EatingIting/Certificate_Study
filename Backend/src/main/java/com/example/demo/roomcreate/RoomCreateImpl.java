package com.example.demo.roomcreate;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class RoomCreateImpl implements RoomCreateService {

    private final RoomCreateMapper mapper;

    @Override
    public void insertRoom(RoomCreateRequest request, String userEmail) {

        RoomCreateVO vo = new RoomCreateVO();

        vo.setRoomId(UUID.randomUUID().toString());
        vo.setHostUserEmail(userEmail);
        vo.setHostUserNickname(request.getHostUserNickname());

        vo.setTitle(request.getTitle());
        vo.setContent(request.getContent());

        vo.setGender(request.getGender());
        vo.setMaxParticipants(request.getMaxParticipants());

        vo.setCategoryId(request.getCategoryId());
        vo.setStatus("OPEN");

        vo.setStartDate(request.getStartDate());
        vo.setEndDate(request.getEndDate());
        vo.setExamDate(request.getExamDate());
        vo.setDeadline(request.getDeadline());

        mapper.insertRoom(vo);
    }


    @Override
    public List<RoomCreateVO> getRooms() {
        return mapper.findAllRooms();
    }

    @Override
    public RoomCreateVO getRoomDetail(String roomId) {
        return mapper.findRoomById(roomId);
    }
}

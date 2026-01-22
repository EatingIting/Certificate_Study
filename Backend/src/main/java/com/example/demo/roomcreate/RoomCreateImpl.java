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
    public void createRoom(RoomCreateRequest request, String userId) {
        RoomCreateVO vo = new RoomCreateVO();
        vo.setRoomId(UUID.randomUUID().toString());
        vo.setHostUserId(userId);

        vo.setTitle(request.getTitle());
        vo.setContent(request.getDescription());      // description -> content
        vo.setCapacity(request.getGender());          // gender -> capacity(컬럼명/VO명은 capacity지만 의미는 성별제한)
        vo.setMaxParticipants(request.getMaxPeople()); // maxPeople -> maxParticipants
        vo.setStatus("OPEN");
        vo.setCategoryId(request.getCategoryId());

        int result = mapper.insertRoom(vo);
        System.out.println("insert result = " + result);
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

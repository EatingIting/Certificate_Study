package com.example.demo.모집.service;

import com.example.demo.s3.S3Uploader;
import com.example.demo.모집.mapper.RoomCreateMapper;
import com.example.demo.모집.request.RoomCreateRequest;
import com.example.demo.모집.vo.RoomCreateVO;
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
    private final S3Uploader s3Uploader;

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

        if (request.getImage() != null && !request.getImage().isEmpty()) {

            try {
                String imageUrl = s3Uploader.upload(request.getImage());
                vo.setRoomImg(imageUrl);

            } catch (Exception e) {
                e.printStackTrace();
                throw new RuntimeException("S3 이미지 업로드 실패: " + e.getMessage());
            }
        }

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

    @Override
    public void updateRoom(String roomId,
                           RoomCreateRequest request,
                           String userEmail) {

        RoomCreateVO existing = mapper.findRoomById(roomId);

        if (existing == null) {
            throw new RuntimeException("존재하지 않는 스터디입니다.");
        }

        if (!existing.getHostUserEmail().equals(userEmail)) {
            throw new RuntimeException("수정 권한이 없습니다.");
        }

        RoomCreateVO vo = new RoomCreateVO();
        vo.setRoomId(roomId);

        vo.setHostUserNickname(request.getHostUserNickname());
        vo.setTitle(request.getTitle());
        vo.setContent(request.getContent());

        vo.setGender(request.getGender());
        vo.setMaxParticipants(request.getMaxParticipants());

        vo.setCategoryId(request.getCategoryId());

        vo.setStartDate(request.getStartDate());
        vo.setEndDate(request.getEndDate());
        vo.setExamDate(request.getExamDate());
        vo.setDeadline(request.getDeadline());

        String roomImg = existing.getRoomImg();

        if (request.getImage() != null && !request.getImage().isEmpty()) {

            try {
                roomImg = s3Uploader.upload(request.getImage());

            } catch (Exception e) {
                e.printStackTrace();
                throw new RuntimeException("S3 이미지 수정 실패: " + e.getMessage());
            }
        }

        vo.setRoomImg(roomImg);

        mapper.updateRoom(vo);
    }
}

package com.example.demo.roomcreate;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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

        // ✅ 이미지 저장
        if (request.getImage() != null && !request.getImage().isEmpty()) {

            String fileName = UUID.randomUUID() + "_" +
                    request.getImage().getOriginalFilename();

            // ✅ WebConfig와 동일한 경로로 저장해야 함
            Path savePath = Paths.get("C:/upload/" + fileName);

            try {
                Files.createDirectories(savePath.getParent());
                request.getImage().transferTo(savePath.toFile());
            } catch (Exception e) {
                throw new RuntimeException("이미지 저장 실패");
            }

            // DB에는 접근 경로 저장
            vo.setRoomImg("/upload/" + fileName);
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

        /* ✅ 이미지 수정 처리 */
        String roomImg = existing.getRoomImg(); // 기존 이미지 유지

        if (request.getImage() != null && !request.getImage().isEmpty()) {

            String fileName = UUID.randomUUID() + "_" +
                    request.getImage().getOriginalFilename();

            Path savePath = Paths.get("C:/upload/" + fileName);

            try {
                Files.createDirectories(savePath.getParent());
                request.getImage().transferTo(savePath.toFile());
            } catch (Exception e) {
                throw new RuntimeException("이미지 수정 실패");
            }

            roomImg = "/upload/" + fileName;
        }

        vo.setRoomImg(roomImg);

        mapper.updateRoom(vo);
    }


}

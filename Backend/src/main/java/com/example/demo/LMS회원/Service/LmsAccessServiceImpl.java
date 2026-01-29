package com.example.demo.LMS회원.Service;

import com.example.demo.LMS회원.Repository.RoomJoinRequestRepository;
import com.example.demo.LMS회원.Repository.RoomRepository;
import com.example.demo.entity.Room;
import com.example.demo.entity.RoomJoinRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LmsAccessServiceImpl implements LmsAccessService {

    private final RoomRepository roomRepository;
    private final RoomJoinRequestRepository roomJoinRequestRepository;

    @Override
    public boolean hasAccessToRoom(String userEmail, String roomId) {
        // 1. 방장인지 확인
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room != null && room.getHostUserEmail().equals(userEmail)) {
            return true;
        }

        // 2. 승인된 참가자인지 확인
        List<RoomJoinRequest> approvedRequests = roomJoinRequestRepository
                .findByRequestUserEmailAndRoomId(userEmail, roomId);
        
        return approvedRequests.stream()
                .anyMatch(request -> "승인".equals(request.getStatus()));
    }

    @Override
    public boolean hasAccessToAnyRoom(String userEmail) {
        // 1. 방장인 방이 있는지 확인
        List<Room> hostedRooms = roomRepository.findByHostUserEmail(userEmail);
        if (!hostedRooms.isEmpty()) {
            return true;
        }

        // 2. 승인된 참가 신청이 있는지 확인
        List<RoomJoinRequest> approvedRequests = roomJoinRequestRepository
                .findByRequestUserEmailAndStatus(userEmail, "승인");
        
        return !approvedRequests.isEmpty();
    }
}

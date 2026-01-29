package com.example.demo.controller;

import com.example.demo.classroom.ClassRoomService;
import com.example.demo.classroom.ClassRoomVO;
import com.example.demo.LMS회원.Service.LmsAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classrooms")
@CrossOrigin(origins = "*")
public class ClassRoomController {

    private final ClassRoomService classRoomService;
    private final LmsAccessService lmsAccessService;

    @GetMapping("/my")
    public ResponseEntity<?> getMyClassRooms(Authentication authentication) {

        String email = authentication.getName();
        
        // LMS 접근 권한 체크 (승인된 방이 있거나 방장인 경우만 접근 가능)
        if (!lmsAccessService.hasAccessToAnyRoom(email)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "LMS 접근 권한이 없습니다. 승인된 스터디룸이 필요합니다."));
        }
        
        List<ClassRoomVO> classRooms = classRoomService.getMyClassRooms(email);
        return ResponseEntity.ok(classRooms);
    }
}

package com.example.demo.controller;

import com.example.demo.classroom.ClassRoomService;
import com.example.demo.classroom.ClassRoomVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classrooms")
@CrossOrigin(origins = "*")
public class ClassRoomController {

    private final ClassRoomService classRoomService;

    @GetMapping("/my")
    public List<ClassRoomVO> getMyClassRooms(Authentication authentication) {

        String email = authentication.getName();
        return classRoomService.getMyClassRooms(email);
    }
}

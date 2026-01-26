package com.example.demo.classroom;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ClassRoomServiceImpl implements ClassRoomService {

    private final ClassRoomMapper mapper;

    @Override
    public List<ClassRoomVO> getMyClassRooms(String email) {
        return mapper.selectMyClassRooms(email);
    }
}

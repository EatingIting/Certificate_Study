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
        List<ClassRoomVO> list = mapper.selectMyClassRooms(email);

        // ✅ /lms/1 형태를 위해 프론트에서 사용할 subjectId를 순번으로 주입
        // (DB 스키마/SQL 의존 없이 동작)
        for (int i = 0; i < list.size(); i++) {
            list.get(i).setSubjectId(i + 1);
        }

        return list;
    }
}

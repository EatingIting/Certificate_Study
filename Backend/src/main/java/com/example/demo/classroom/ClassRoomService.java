package com.example.demo.classroom;

import java.util.List;

public interface ClassRoomService {

    List<ClassRoomVO> getMyClassRooms(String email);
}

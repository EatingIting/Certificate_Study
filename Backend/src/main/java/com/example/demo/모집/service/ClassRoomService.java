package com.example.demo.모집.service;

import com.example.demo.모집.vo.ClassRoomVO;

import java.util.List;

public interface ClassRoomService {

    List<ClassRoomVO> getMyClassRooms(String email);
}

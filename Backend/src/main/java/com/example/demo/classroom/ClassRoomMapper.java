package com.example.demo.classroom;

import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface ClassRoomMapper {

    List<ClassRoomVO> selectMyClassRooms(String email);
}

package com.example.demo.모집.mapper;

import com.example.demo.모집.vo.ClassRoomVO;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface ClassRoomMapper {

    List<ClassRoomVO> selectMyClassRooms(String email);
}

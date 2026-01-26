package com.example.demo.main;

import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface MainMapper {

    List<MainVO> selectMainRooms();
}

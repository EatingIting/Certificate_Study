package com.example.demo.모집.mapper;

import com.example.demo.모집.vo.MainVO;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface MainMapper {

    List<MainVO> selectMainRooms();
}

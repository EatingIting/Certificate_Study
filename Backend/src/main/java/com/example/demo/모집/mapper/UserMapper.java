package com.example.demo.모집.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {

    // email로 userId 조회
    String findUserIdByEmail(@Param("email") String email);

    // email로 nickname 조회 (추가)
    String findNicknameByEmail(@Param("email") String email);
}
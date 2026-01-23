package com.example.demo.mypage;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;

@Mapper
public interface MyPageMapper {

    MyPageVO findByUserId(@Param("userId") String userId);

    void updateMyPage(
            @Param("userId") String userId,
            @Param("name") String name,
            @Param("nickname") String nickname,
            @Param("birthDate") LocalDate birthDate,
            @Param("introduction") String introduction,
            @Param("profileImg") String profileImg
    );

    void deleteByEmail(@Param("email") String email);
}

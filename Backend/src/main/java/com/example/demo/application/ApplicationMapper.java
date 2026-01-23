package com.example.demo.application;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ApplicationMapper {

    // 신청 받은 스터디 목록
    List<ApplicationVO> selectReceivedApplications(
            @Param("hostUserEmail") String hostUserEmail
    );

    // 내가 신청한 스터디 목록
    List<ApplicationVO> selectSentApplications(
            @Param("requestUserEmail") String requestUserEmail
    );

    // 승인
    int approveApplication(
            @Param("joinId") String joinId,
            @Param("hostUserEmail") String hostUserEmail
    );

    // 거절
    int rejectApplication(
            @Param("joinId") String joinId,
            @Param("hostUserEmail") String hostUserEmail
    );

    // 신청
    int insertApplication(
            @Param("joinId") String joinId,
            @Param("requestUserEmail") String requestUserEmail,
            @Param("requestUserNickname") String requestUserNickname,
            @Param("roomId") String roomId,
            @Param("applyMessage") String applyMessage
    );

    //중복
    int existsActiveApplication(
            @Param("roomId") String roomId,
            @Param("requestUserEmail") String requestUserEmail
    );

}
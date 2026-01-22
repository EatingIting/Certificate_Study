package com.example.demo.application;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ApplicationMapper {

    // 신청 받은 스터디 목록
    List<ApplicationVO> selectReceivedApplications(
            @Param("ownerUserId") String ownerUserId
    );

    // 내가 신청한 스터디 목록
    List<ApplicationVO> selectSentApplications(
            @Param("requestUserId") String requestUserId
    );

    // 승인
    int approveApplication(
            @Param("joinId") String joinId,
            @Param("ownerUserId") String ownerUserId
    );

    // 거절
    int rejectApplication(
            @Param("joinId") String joinId,
            @Param("ownerUserId") String ownerUserId
    );

    int insertApplication(
            @Param("joinId") String joinId,
            @Param("requestUserId") String requestUserId,
            @Param("roomId") String roomId,
            @Param("applyMessage") String applyMessage
    );
}
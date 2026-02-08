package com.example.demo.모집.mapper;

import com.example.demo.모집.vo.ApplicationVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ApplicationMapper {

    // 신청 받은 목록
    List<ApplicationVO> selectReceivedApplications(
            @Param("hostUserEmail") String hostUserEmail
    );

    // 내가 신청한 목록
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

    // 신청 insert
    int insertApplication(
            @Param("joinId") String joinId,
            @Param("requestUserEmail") String requestUserEmail,
            @Param("requestUserNickname") String requestUserNickname,
            @Param("roomId") String roomId,
            @Param("applyMessage") String applyMessage
    );

    // 신청 상태 조회
    String findStatus(
            @Param("roomId") String roomId,
            @Param("requestUserEmail") String requestUserEmail
    );

    // 거절된 신청 재신청 처리
    int reapply(
            @Param("roomId") String roomId,
            @Param("requestUserEmail") String requestUserEmail,
            @Param("requestUserNickname") String requestUserNickname,
            @Param("applyMessage") String applyMessage
    );


    // 중복 체크 (신청중/승인)
    int existsActiveApplication(
            @Param("roomId") String roomId,
            @Param("requestUserEmail") String requestUserEmail
    );

    // joinId → roomId 조회
    String getRoomIdByJoinId(@Param("joinId") String joinId);

    // joinId → 신청자 이메일 조회
    String getRequestUserEmailByJoinId(@Param("joinId") String joinId);

    // joinId → 스터디 제목 조회
    String getStudyTitleByJoinId(@Param("joinId") String joinId);

    // 승인 인원 count
    int countApprovedByRoomId(@Param("roomId") String roomId);

    // 정원 조회
    int getMaxParticipants(@Param("roomId") String roomId);

    // 신청중 자동 거절
    int autoRejectPending(@Param("roomId") String roomId);

    // 방 상태 CLOSED 변경
    int closeRoom(@Param("roomId") String roomId);

    // 신청자 성별 조회
    String getUserGender(@Param("email") String email);

    // 방 성별 제한 조회
    String getRoomGender(@Param("roomId") String roomId);

    //방장 이메일 조회
    String getHostEmailByRoomId(@Param("roomId") String roomId);

}

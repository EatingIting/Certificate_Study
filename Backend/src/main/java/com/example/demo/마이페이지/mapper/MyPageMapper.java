package com.example.demo.마이페이지.mapper;

import com.example.demo.마이페이지.vo.MyPageVO;
import com.example.demo.마이페이지.vo.MyStudyVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface MyPageMapper {

    MyPageVO findByUserId(@Param("userId") String userId);

    void updateMyPage(
            @Param("userId") String userId,
            @Param("name") String name,
            @Param("nickname") String nickname,
            @Param("birthDate") LocalDate birthDate,
            @Param("gender") String gender,
            @Param("introduction") String introduction,
            @Param("profileImg") String profileImg
    );

    // 방장 여부 체크
    int countRoomsByHost(@Param("email") String email);

    // user_id FK 삭제
    void deleteBoardCommentsByUser(@Param("userId") String userId);
    void deleteBoardPostsByUser(@Param("userId") String userId);
    void deleteChatMessagesByUser(@Param("userId") String userId);
    void deleteChatParticipantsByUser(@Param("userId") String userId);
    void deleteSchedulesByUser(@Param("userId") String userId);
    void deleteUserInterestCategory(@Param("userId") String userId);

    // email FK 삭제
    void deleteJoinRequestByRequester(@Param("email") String email);
    void deleteJoinRequestByHost(@Param("email") String email);

    // 마지막 users 삭제
    void deleteUser(@Param("userId") String userId);

    String getGender(@Param("email") String email);

    List<MyStudyVO> getJoinedStudies(String email);
    List<MyStudyVO> getCompletedStudies(String email);
}

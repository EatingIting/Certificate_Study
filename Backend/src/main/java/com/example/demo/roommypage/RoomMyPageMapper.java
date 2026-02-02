package com.example.demo.roommypage;

import com.example.demo.roommypage.dto.MyRoomItem;
import com.example.demo.roommypage.dto.RoomMyPageResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RoomMyPageMapper {

    // auth.getName()이 email일 수도, user_id(UUID)일 수도 있어서 email로 해석
    String resolveEmail(@Param("principal") String principal);

    // auth.getName()이 email일 수도, user_id(UUID)일 수도 있어서 user_id로 해석
    String resolveUserId(@Param("principal") String principal);

    // 마이페이지 조회 (방장 or 승인멤버만)
    RoomMyPageResponse selectRoomMyPage(@Param("roomId") String roomId,
                                        @Param("email") String email);

    // 승인 멤버 닉네임 변경
    int updateMemberNickname(@Param("roomId") String roomId,
                             @Param("email") String email,
                             @Param("roomNickname") String roomNickname);

    // 방장 닉네임 변경
    int updateHostNickname(@Param("roomId") String roomId,
                           @Param("email") String email,
                           @Param("roomNickname") String roomNickname);

    // =======================
    // 내 활동(게시글/댓글)
    // =======================

    // 내 게시글 수 (방 기준)
    long countMyPosts(@Param("roomId") String roomId,
                      @Param("userId") String userId);

    // 내 댓글 수 (방 기준: posts 조인)
    long countMyComments(@Param("roomId") String roomId,
                         @Param("userId") String userId);

    // 최근 내가 쓴 게시글 N개
    List<RoomMyPageResponse.RecentPost> selectRecentMyPosts(@Param("roomId") String roomId,
                                                            @Param("userId") String userId,
                                                            @Param("limit") int limit);

    // 최근 내가 쓴 댓글 N개 (+ 원글 제목 포함)
    List<RoomMyPageResponse.RecentComment> selectRecentMyComments(@Param("roomId") String roomId,
                                                                  @Param("userId") String userId,
                                                                  @Param("limit") int limit);

    List<MyRoomItem> selectMyRooms(@Param("email") String email);
}

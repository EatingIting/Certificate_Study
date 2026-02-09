package com.example.demo.roomcontext;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RoomContextMapper {

    RoomBasicVO selectRoomBasic(@Param("roomId") String roomId);

    int countApprovedMember(@Param("roomId") String roomId,
                            @Param("email") String email);

    String selectLatestLeaveReason(@Param("roomId") String roomId,
                                   @Param("email") String email);

    /** host_user_email이 비어 있을 때 대체 방장 1명(승인 멤버 중 1명) 이메일 */
    String selectFallbackHostEmail(@Param("roomId") String roomId);
}

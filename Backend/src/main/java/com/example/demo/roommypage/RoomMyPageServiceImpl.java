package com.example.demo.roommypage;

import com.example.demo.roommypage.dto.MyRoomItem;
import com.example.demo.roommypage.dto.RoomMyPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomMyPageServiceImpl implements RoomMyPageService {

    private final RoomMyPageMapper roomMyPageMapper;

    // 최근 활동 개수
    private static final int RECENT_LIMIT = 3;

    @Override
    @Transactional(readOnly = true)
    public RoomMyPageResponse getRoomMyPage(String roomId, String principal) {

        System.out.println("====== [RoomMyPage DEBUG START] ======");
        System.out.println("principal(auth.getName) = " + principal);

        String email = resolveEmailOrThrow(principal);
        String userId = resolveUserIdOrThrow(principal);

        System.out.println("resolved email = " + email);
        System.out.println("resolved userId = " + userId);
        System.out.println("roomId = " + roomId);

        RoomMyPageResponse response = roomMyPageMapper.selectRoomMyPage(roomId, email);
        if (response == null) {
            throw new IllegalArgumentException("승인된 멤버 또는 방장만 마이페이지를 조회할 수 있습니다.");
        }

        // =========================
        // 내 활동(게시글/댓글) 채우기
        // =========================
        long postCount = roomMyPageMapper.countMyPosts(roomId, userId);
        long commentCount = roomMyPageMapper.countMyComments(roomId, userId);

        List<RoomMyPageResponse.RecentPost> recentPosts =
                roomMyPageMapper.selectRecentMyPosts(roomId, userId, RECENT_LIMIT);

        List<RoomMyPageResponse.RecentComment> recentComments =
                roomMyPageMapper.selectRecentMyComments(roomId, userId, RECENT_LIMIT);

        response.setPostCount(postCount);
        response.setCommentCount(commentCount);
        response.setRecentPosts(recentPosts);
        response.setRecentComments(recentComments);

        return response;
    }

    @Override
    @Transactional
    public RoomMyPageResponse updateRoomNickname(String roomId, String principal, String roomNickname) {

        String email = resolveEmailOrThrow(principal);

        String trimmed = (roomNickname == null) ? "" : roomNickname.trim();
        if (trimmed.length() < 2 || trimmed.length() > 20) {
            throw new IllegalArgumentException("닉네임은 2자 이상 20자 이하로 입력해주세요.");
        }

        int updated = roomMyPageMapper.updateMemberNickname(roomId, email, trimmed);
        if (updated == 0) {
            updated = roomMyPageMapper.updateHostNickname(roomId, email, trimmed);
        }

        if (updated == 0) {
            throw new IllegalArgumentException("승인된 멤버 또는 방장만 닉네임을 변경할 수 있습니다.");
        }

        RoomMyPageResponse response = roomMyPageMapper.selectRoomMyPage(roomId, email);
        if (response == null) {
            throw new IllegalStateException("닉네임 변경은 완료됐지만 마이페이지 정보를 불러올 수 없습니다.");
        }

        // 닉네임 변경 응답에도 내 활동 포함
        String userId = resolveUserIdOrThrow(principal);

        long postCount = roomMyPageMapper.countMyPosts(roomId, userId);
        long commentCount = roomMyPageMapper.countMyComments(roomId, userId);

        List<RoomMyPageResponse.RecentPost> recentPosts =
                roomMyPageMapper.selectRecentMyPosts(roomId, userId, RECENT_LIMIT);

        List<RoomMyPageResponse.RecentComment> recentComments =
                roomMyPageMapper.selectRecentMyComments(roomId, userId, RECENT_LIMIT);

        response.setPostCount(postCount);
        response.setCommentCount(commentCount);
        response.setRecentPosts(recentPosts);
        response.setRecentComments(recentComments);

        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyRoomItem> getMyRooms(String principal) {
        String email = resolveEmailOrThrow(principal);
        return roomMyPageMapper.selectMyRooms(email);
    }

    private String resolveEmailOrThrow(String principal) {
        if (principal == null || principal.isBlank()) {
            throw new IllegalArgumentException("인증 정보가 없습니다.");
        }

        String email = roomMyPageMapper.resolveEmail(principal);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("인증된 사용자 이메일을 확인할 수 없습니다.");
        }

        return email;
    }

    private String resolveUserIdOrThrow(String principal) {
        if (principal == null || principal.isBlank()) {
            throw new IllegalArgumentException("인증 정보가 없습니다.");
        }

        String userId = roomMyPageMapper.resolveUserId(principal);
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("인증된 사용자 ID를 확인할 수 없습니다.");
        }

        return userId;
    }
}

package com.example.demo.board.service;

import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardPostVO;
import com.example.demo.roomparticipant.RoomParticipantMapper;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BoardPostServiceImpl implements BoardPostService {

    private final BoardPostMapper boardPostMapper;
    private final AuthService authService;
    private final RoomParticipantMapper roomParticipantMapper;

    private String getUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);
        if (user == null) throw new IllegalStateException("유저를 찾을 수 없습니다.");
        return user.getUserId(); // UUID(36)
    }

    private void requireMember(String roomId, String email) {
        // 방장은 room.host_user_email에만 있고 room_join_request에 없을 수 있으므로, 방장이면 통과
        String hostEmail = roomParticipantMapper.selectHostEmail(roomId);
        if (hostEmail != null && email != null
                && hostEmail.trim().equalsIgnoreCase(email.trim())) {
            return;
        }
        int cnt = roomParticipantMapper.countApprovedByEmail(roomId, email);
        if (cnt <= 0) throw new AccessDeniedException("스터디원만 접근 가능합니다.");
    }

    private void requireHost(String roomId, String email) {
        String hostEmail = roomParticipantMapper.selectHostEmail(roomId);
        if (hostEmail == null || email == null || !hostEmail.trim().equalsIgnoreCase(email.trim())) {
            throw new AccessDeniedException("방장만 접근 가능합니다.");
        }
    }
    private boolean isNotice(BoardPostVO post) {
        if (post == null || post.getCategory() == null) return false;
        String c = post.getCategory();
        return "공지".equals(c) || "NOTICE".equalsIgnoreCase(c);
    }

    @Override
    public Map<String, Object> getPostList(String roomId, String category, String keyword, int page, int size, String email) {
        requireMember(roomId, email);
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 50);
        int offset = (safePage - 1) * safeSize;

        List<BoardPostVO> items = boardPostMapper.selectPostList(roomId, category, keyword, offset, safeSize);
        int total = boardPostMapper.countPostList(roomId, category, keyword);

        Map<String, Object> res = new HashMap<>();
        res.put("items", items);
        res.put("page", safePage);
        res.put("size", safeSize);
        res.put("total", total);
        res.put("totalPages", (int) Math.ceil((double) total / safeSize));
        return res;
    }

    @Override
    public BoardPostVO getPostById(long postId, String email) {
        BoardPostVO post = boardPostMapper.selectPostById(postId);
        if (post == null) return null;

        requireMember(post.getRoomId(), email); // post에 roomId 있어야 함(보통 있음)
        return post;
    }

    @Override
    public long createPost(BoardPostVO post, String email) {
        if (isNotice(post)) requireHost(post.getRoomId(), email);
        else requireMember(post.getRoomId(), email);

        post.setUserId(getUserIdByEmail(email));
        int inserted = boardPostMapper.insertPost(post);
        if (inserted == 0 || post.getPostId() == null) throw new IllegalStateException("게시글 등록에 실패했습니다.");
        return post.getPostId();
    }

    @Override
    public void updatePost(BoardPostVO post, String email) {
        BoardPostVO saved = boardPostMapper.selectPostById(post.getPostId());
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        if (isNotice(saved)) {
            requireHost(saved.getRoomId(), email);
            int updated = boardPostMapper.updatePostByHost(post);
            if (updated == 0) throw new IllegalStateException("공지글 수정 실패");
            return;
        }

        post.setUserId(getUserIdByEmail(email));
        int updated = boardPostMapper.updatePost(post);
        if (updated == 0) throw new IllegalStateException("게시글 수정 불가 (작성자 아님/삭제됨/존재하지 않음)");
    }

    @Override
    public void deletePost(long postId, String email) {
        BoardPostVO saved = boardPostMapper.selectPostById(postId);
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        // 공지글: 방장만 삭제
        if (isNotice(saved)) {
            requireHost(saved.getRoomId(), email);
            int updated = boardPostMapper.softDeletePostByHost(postId);
            if (updated == 0) throw new IllegalStateException("공지글 삭제 실패");
            return;
        }

        // 일반글: 작성자 먼저 시도
        String userId = getUserIdByEmail(email);
        int updated = boardPostMapper.softDeletePost(postId, userId);
        if (updated > 0) return;

        // 여기서 requireHost를 바로 호출하지 말고,
        // 방장인지 확인해서 메시지를 더 정확히 내기
        String hostEmail = roomParticipantMapper.selectHostEmail(saved.getRoomId());
        boolean isHost = hostEmail != null && email != null
                && hostEmail.trim().equalsIgnoreCase(email.trim());

        if (!isHost) {
            throw new AccessDeniedException("삭제 권한이 없습니다. (작성자 또는 방장만 삭제 가능)");
        }

        // 방장이면 방장 삭제 수행
        int updatedByHost = boardPostMapper.softDeletePostByHost(postId);
        if (updatedByHost == 0) {
            throw new IllegalStateException("게시글 삭제 실패(이미 삭제됨/존재하지 않음)");
        }
    }

    @Override
    public void setPinned(long postId, String email, boolean isPinned) {
        BoardPostVO saved = boardPostMapper.selectPostById(postId);
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        // pinned는 공지글에서만
        if (!isNotice(saved)) {
            throw new AccessDeniedException("상단 고정은 공지글에서만 가능합니다.");
        }

        // 공지글 pinned는 방장만
        requireHost(saved.getRoomId(), email);

        int updated = boardPostMapper.updatePinnedByHost(postId, isPinned);
        if (updated == 0) throw new IllegalStateException("공지글 고정 변경 실패");
    }

    @Override
    public void incrementViewCount(long postId) {
        boardPostMapper.incrementViewCount(postId);
    }

    @Override
    public void requireCanEdit(long postId, String email) {
        BoardPostVO saved = boardPostMapper.selectPostById(postId);
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        // 공지글: 방장만 수정 가능
        if (isNotice(saved)) {
            requireHost(saved.getRoomId(), email);
            return;
        }

        // 일반글: 작성자만 수정 가능
        String myUserId = getUserIdByEmail(email);
        if (!myUserId.equals(saved.getUserId())) {
            throw new AccessDeniedException("작성자만 수정할 수 있습니다.");
        }
    }

    @Override
    public Map<String, Boolean> getPostPermissions(long postId, String email) {
        BoardPostVO saved = boardPostMapper.selectPostById(postId);
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        // 내 userId(UUID)
        String myUserId = getUserIdByEmail(email);

        // 작성자 여부(UUID vs UUID)
        boolean owner = myUserId != null && myUserId.equals(saved.getUserId());

        // 방장 여부(email vs hostEmail)
        String hostEmail = roomParticipantMapper.selectHostEmail(saved.getRoomId());
        boolean host = hostEmail != null && email != null
                && hostEmail.trim().equalsIgnoreCase(email.trim());

        boolean notice = isNotice(saved);

        boolean canEdit = notice ? host : owner;
        boolean canDelete = notice ? host : (owner || host);

        return Map.of("canEdit", canEdit, "canDelete", canDelete);
    }

    @Override
    @Transactional
    public int purgeDeletedPosts(int days) {
        if (days <= 0) throw new IllegalArgumentException("days must be positive");
        return boardPostMapper.hardDeleteOlderThanDays(days);
    }
}
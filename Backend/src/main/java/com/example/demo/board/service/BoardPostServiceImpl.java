package com.example.demo.board.service;

import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardPostVO;
import com.example.demo.roomparticipant.RoomParticipantMapper;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class BoardPostServiceImpl implements BoardPostService {

    private final BoardPostMapper boardPostMapper;
    private final AuthService authService;
    private final RoomParticipantMapper roomParticipantMapper;

    public BoardPostServiceImpl(BoardPostMapper boardPostMapper,
                                AuthService authService,
                                RoomParticipantMapper roomParticipantMapper) {
        this.boardPostMapper = boardPostMapper;
        this.authService = authService;
        this.roomParticipantMapper = roomParticipantMapper;
    }

    private String getUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);
        if (user == null) throw new IllegalStateException("유저를 찾을 수 없습니다.");
        return user.getUserId(); // UUID(36)
    }

    private void requireMember(String roomId, String email) {
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
        if (hostEmail == null || !hostEmail.equals(email)) {
            throw new AccessDeniedException("방장만 접근 가능합니다.");
        }
    }

    private boolean isNotice(BoardPostVO post) {
        return post != null && "공지".equals(post.getCategory());
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

        requireMember(post.getRoomId(), email);
        return post;
    }

    @Override
    public long createPost(BoardPostVO post, String email) {
        if (isNotice(post)) requireHost(post.getRoomId(), email);
        else requireMember(post.getRoomId(), email);

        post.setUserId(getUserIdByEmail(email));
        int inserted = boardPostMapper.insertPost(post);

        if (inserted == 0 || post.getPostId() == null)
            throw new IllegalStateException("게시글 등록에 실패했습니다.");

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

        if (updated == 0)
            throw new IllegalStateException("게시글 수정 불가");
    }

    @Override
    public void deletePost(long postId, String email) {
        BoardPostVO saved = boardPostMapper.selectPostById(postId);
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        if (isNotice(saved)) {
            requireHost(saved.getRoomId(), email);
            int updated = boardPostMapper.softDeletePostByHost(postId);
            if (updated == 0) throw new IllegalStateException("공지글 삭제 실패");
            return;
        }

        String userId = getUserIdByEmail(email);
        int updated = boardPostMapper.softDeletePost(postId, userId);

        if (updated == 0)
            throw new IllegalStateException("게시글 삭제 불가");
    }

    @Override
    public void setPinned(long postId, String email, boolean isPinned) {
        BoardPostVO saved = boardPostMapper.selectPostById(postId);
        if (saved == null) throw new IllegalStateException("게시글이 존재하지 않습니다.");

        requireMember(saved.getRoomId(), email);

        if (isNotice(saved)) {
            requireHost(saved.getRoomId(), email);
            int updated = boardPostMapper.updatePinnedByHost(postId, isPinned);
            if (updated == 0) throw new IllegalStateException("공지글 고정 변경 실패");
            return;
        }

        String userId = getUserIdByEmail(email);
        int updated = boardPostMapper.updatePinned(postId, userId, isPinned);

        if (updated == 0)
            throw new IllegalStateException("고정 변경 불가");
    }

    @Override
    public void incrementViewCount(long postId) {
        boardPostMapper.incrementViewCount(postId);
    }

    @Override
    public String getWriterIdByPostId(long postId) {
        return boardPostMapper.findWriterIdByPostId(postId);
    }
}

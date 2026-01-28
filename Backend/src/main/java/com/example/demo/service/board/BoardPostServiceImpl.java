package com.example.demo.service.board;

import com.example.demo.auth.AuthService;
import com.example.demo.auth.AuthServiceImpl;
import com.example.demo.auth.AuthVO;
import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardPostVO;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class BoardPostServiceImpl implements BoardPostService {

    private final BoardPostMapper boardPostMapper;
    private final AuthService authService;

    public BoardPostServiceImpl(BoardPostMapper boardPostMapper, AuthService authService) {
        this.boardPostMapper = boardPostMapper;
        this.authService = authService;
    }

    private String getUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);
        if (user == null) throw new IllegalStateException("유저를 찾을 수 없습니다.");
        return user.getUserId(); // UUID(36)
    }

    @Override
    public Map<String, Object> getPostList(String roomId, String category, String keyword, int page, int size) {
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
    public BoardPostVO getPostById(long postId) {
        return boardPostMapper.selectPostById(postId);
    }

    @Override
    public long createPost(BoardPostVO post, String email) {
        post.setUserId(getUserIdByEmail(email)); // ✅ 여기서 UUID로 확정

        int inserted = boardPostMapper.insertPost(post);
        if (inserted == 0 || post.getPostId() == null) {
            throw new IllegalStateException("게시글 등록에 실패했습니다.");
        }
        return post.getPostId();
    }

    @Override
    public void updatePost(BoardPostVO post, String email) {
        post.setUserId(getUserIdByEmail(email)); // ✅ 작성자 검증도 UUID 기준으로

        int updated = boardPostMapper.updatePost(post);
        if (updated == 0) {
            throw new IllegalStateException("게시글 수정 불가 (작성자 아님/삭제됨/존재하지 않음)");
        }
    }

    @Override
    public void deletePost(long postId, String email) {
        String userId = getUserIdByEmail(email);

        int updated = boardPostMapper.softDeletePost(postId, userId);
        if (updated == 0) {
            throw new IllegalStateException("게시글 삭제 불가 (작성자 아님/삭제됨/존재하지 않음)");
        }
    }

    @Override
    public void setPinned(long postId, String userId, boolean isPinned) {
        int updated = boardPostMapper.updatePinned(postId, userId, isPinned);
        if (updated == 0) {
            throw new IllegalStateException("고정 변경 불가 (작성자 아님/삭제됨/존재하지 않음)");
        }
    }

    @Override
    public void incrementViewCount(long postId) {
        boardPostMapper.incrementViewCount(postId);
    }
}
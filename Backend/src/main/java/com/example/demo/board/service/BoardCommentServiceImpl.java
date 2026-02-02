package com.example.demo.board.service;
import com.example.demo.board.mapper.BoardCommentMapper;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BoardCommentServiceImpl implements BoardCommentService {

    private final BoardCommentMapper boardCommentMapper;
    private final AuthService authService;

    public BoardCommentServiceImpl(BoardCommentMapper boardCommentMapper, AuthService authService) {
        this.boardCommentMapper = boardCommentMapper;
        this.authService = authService;
    }

    private String resolveUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);
        if (user == null) {
            throw new IllegalStateException("유저를 찾을 수 없습니다. (email=" + email + ")");
        }
        return user.getUserId(); // ✅ UUID(36)
    }

    @Override
    public List<BoardCommentVO> getByPostId(long postId) {
        return boardCommentMapper.selectByPostId(postId);
    }

    @Override
    public long addComment(BoardCommentVO comment, String email) {
        String userId = resolveUserIdByEmail(email);
        comment.setUserId(userId);

        int inserted = boardCommentMapper.insert(comment);
        if (inserted == 0 || comment.getCommentId() == null) {
            throw new IllegalStateException("댓글 등록에 실패했습니다.");
        }
        return comment.getCommentId();
    }

    @Override
    public void updateComment(long commentId, String email, String content) {
        String userId = resolveUserIdByEmail(email);

        int updated = boardCommentMapper.updateContent(commentId, userId, content);
        if (updated == 0) {
            throw new IllegalStateException("댓글 수정 불가 (작성자 아님/삭제됨/존재하지 않음)");
        }
    }

    @Override
    public void deleteComment(long commentId, String email) {
        String userId = resolveUserIdByEmail(email);

        int updated = boardCommentMapper.softDelete(commentId, userId);
        if (updated == 0) {
            throw new IllegalStateException("댓글 삭제 불가 (작성자 아님/이미 삭제/존재하지 않음)");
        }
    }
}
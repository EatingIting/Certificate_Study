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

        // 대댓글 검증
        if (comment.getParentId() != null) {
            long parentCommentId = comment.getParentId();

            BoardCommentVO parent = boardCommentMapper.selectByCommentId(parentCommentId);
            if (parent == null) {
                throw new IllegalStateException("부모 댓글을 찾을 수 없습니다. (commentId=" + parentCommentId + ")");
            }

            // 같은 게시글인지 확인
            if (parent.getPostId() != comment.getPostId()) {
                throw new IllegalStateException("부모 댓글의 게시글이 일치하지 않습니다.");
            }

            // 1단 제한: 부모는 최상위 댓글만 가능
            if (parent.getParentId() != null) {
                throw new IllegalStateException("대댓글의 대댓글은 허용되지 않습니다.");
            }

            // 삭제된 댓글에는 답글 금지
            if (parent.getDeletedAt() != null) {
                throw new IllegalStateException("삭제된 댓글에는 답글을 달 수 없습니다.");
            }
        }

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
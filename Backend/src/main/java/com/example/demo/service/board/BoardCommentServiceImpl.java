package com.example.demo.service.board;

import com.example.demo.board.mapper.BoardCommentMapper;
import com.example.demo.board.vo.BoardCommentVO;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BoardCommentServiceImpl implements BoardCommentService {

    private final BoardCommentMapper boardCommentMapper;

    public BoardCommentServiceImpl(BoardCommentMapper boardCommentMapper) {
        this.boardCommentMapper = boardCommentMapper;
    }

    @Override
    public List<BoardCommentVO> getByPostId(long postId) {
        return boardCommentMapper.selectByPostId(postId);
    }

    @Override
    public long addComment(BoardCommentVO comment) {
        int inserted = boardCommentMapper.insert(comment);
        if (inserted == 0 || comment.getCommentId() == null) {
            throw new IllegalStateException("댓글 등록에 실패했습니다.");
        }
        return comment.getCommentId();
    }

    @Override
    public void updateComment(long commentId, String userId, String content) {
        int updated = boardCommentMapper.updateContent(commentId, userId, content);
        if (updated == 0) {
            throw new IllegalStateException("댓글 수정 불가 (작성자 아님/삭제됨/존재하지 않음)");
        }
    }

    @Override
    public void deleteComment(long commentId, String userId) {
        int updated = boardCommentMapper.softDelete(commentId, userId);
        if (updated == 0) {
            throw new IllegalStateException("댓글 삭제 불가 (작성자 아님/이미 삭제/존재하지 않음)");
        }
    }
}
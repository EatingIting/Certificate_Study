package com.example.demo.board.service;

import com.example.demo.board.mapper.BoardCommentMapper;
import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.모집.handler.NotificationWebSocketHandler;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BoardCommentServiceImpl implements BoardCommentService {

    private final BoardCommentMapper boardCommentMapper;
    private final BoardPostMapper boardPostMapper;
    private final AuthService authService;
    private final NotificationWebSocketHandler notificationHandler;

    // ✅ 생성자 수정
    public BoardCommentServiceImpl(
            BoardCommentMapper boardCommentMapper,
            BoardPostMapper boardPostMapper,
            AuthService authService,
            NotificationWebSocketHandler notificationHandler
    ) {
        this.boardCommentMapper = boardCommentMapper;
        this.boardPostMapper = boardPostMapper;
        this.authService = authService;
        this.notificationHandler = notificationHandler;
    }

    private String resolveUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);
        if (user == null) {
            throw new IllegalStateException("유저를 찾을 수 없습니다. (email=" + email + ")");
        }
        return user.getUserId();
    }

    @Override
    public List<BoardCommentVO> getByPostId(long postId) {
        return boardCommentMapper.selectByPostId(postId);
    }

    @Override
    public long addComment(BoardCommentVO comment, String email) {

        // ✅ 댓글 작성자 userId 설정
        String commenterId = resolveUserIdByEmail(email);
        comment.setUserId(commenterId);

        // ==============================
        // ✅ 대댓글 검증 (기존 그대로)
        // ==============================
        if (comment.getParentId() != null) {

            long parentCommentId = comment.getParentId();

            BoardCommentVO parent =
                    boardCommentMapper.selectByCommentId(parentCommentId);

            if (parent == null) {
                throw new IllegalStateException(
                        "부모 댓글을 찾을 수 없습니다. (commentId=" + parentCommentId + ")"
                );
            }

            if (parent.getPostId() != comment.getPostId()) {
                throw new IllegalStateException("부모 댓글의 게시글이 일치하지 않습니다.");
            }

            if (parent.getParentId() != null) {
                throw new IllegalStateException("대댓글의 대댓글은 허용되지 않습니다.");
            }

            if (parent.getDeletedAt() != null) {
                throw new IllegalStateException("삭제된 댓글에는 답글을 달 수 없습니다.");
            }
        }

        int inserted = boardCommentMapper.insert(comment);

        if (inserted == 0 || comment.getCommentId() == null) {
            throw new IllegalStateException("댓글 등록에 실패했습니다.");
        }


        // 1) 게시글 작성자 user_id 조회
        String writerId =
                boardPostMapper.findWriterIdByPostId(comment.getPostId());

        // 2) 자기 글에 자기 댓글이면 알림 X
        if (writerId != null && !writerId.equals(commenterId)) {

            // 3) WebSocket 알림 전송
            notificationHandler.sendToOwner(
                    writerId,
                    "내 게시글에 댓글이 달렸습니다!"
            );

            System.out.println("✅ 댓글 알림 전송 완료 → writerId=" + writerId);
        }

        return comment.getCommentId();
    }

    @Override
    public void updateComment(long commentId, String email, String content) {

        String userId = resolveUserIdByEmail(email);

        int updated =
                boardCommentMapper.updateContent(commentId, userId, content);

        if (updated == 0) {
            throw new IllegalStateException(
                    "댓글 수정 불가 (작성자 아님/삭제됨/존재하지 않음)"
            );
        }
    }

    @Override
    public void deleteComment(long commentId, String email) {

        String userId = resolveUserIdByEmail(email);

        int updated =
                boardCommentMapper.softDelete(commentId, userId);

        if (updated == 0) {
            throw new IllegalStateException(
                    "댓글 삭제 불가 (작성자 아님/이미 삭제/존재하지 않음)"
            );
        }
    }
}

package com.example.demo.board.service;

import com.example.demo.board.handler.CommentNotificationWebSocketHandler;
import com.example.demo.board.mapper.BoardCommentMapper;
import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import com.example.demo.모집.handler.NotificationWebSocketHandler;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class BoardCommentServiceImpl implements BoardCommentService {

    private final BoardCommentMapper boardCommentMapper;
    private final BoardPostMapper boardPostMapper;
    private final AuthService authService;
    private final CommentNotificationWebSocketHandler commentHandler;
    private final NotificationWebSocketHandler notificationHandler;

    public BoardCommentServiceImpl(
            BoardCommentMapper boardCommentMapper,
            BoardPostMapper boardPostMapper,
            AuthService authService,
            CommentNotificationWebSocketHandler commentHandler,
            NotificationWebSocketHandler notificationHandler
    ) {
        this.boardCommentMapper = boardCommentMapper;
        this.boardPostMapper = boardPostMapper;
        this.authService = authService;
        this.commentHandler = commentHandler;
        this.notificationHandler = notificationHandler;
    }

    private String resolveUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);

        if (user == null) {
            throw new IllegalStateException("유저를 찾을 수 없습니다.");
        }

        return user.getUserId();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    @Override
    public List<BoardCommentVO> getByPostId(long postId) {
        return boardCommentMapper.selectByPostId(postId);
    }

    @Override
    public long addComment(BoardCommentVO comment, String email) {

        String commenterId = resolveUserIdByEmail(email);
        comment.setUserId(commenterId);

        int inserted = boardCommentMapper.insert(comment);

        if (inserted == 0 || comment.getCommentId() == null) {
            throw new IllegalStateException("댓글 등록 실패");
        }

        System.out.println("댓글 DB 저장 완료");
        System.out.println("댓글 작성자 commenterId = " + commenterId);

        String writerId =
                boardPostMapper.findWriterIdByPostId(comment.getPostId());

        String postTitle =
                boardPostMapper.findPostTitleByPostId(comment.getPostId());

        String roomId =
                boardPostMapper.findRoomIdByPostId(comment.getPostId());

        System.out.println("게시글 작성자 writerId = " + writerId);
        System.out.println("게시글 roomId = " + roomId);
        System.out.println("게시글 제목 postTitle = " + postTitle);

        Set<String> recipientIds = new LinkedHashSet<>();
        if (hasText(writerId) && !writerId.equals(commenterId)) {
            recipientIds.add(writerId);
        }

        if (comment.getParentId() != null) {
            BoardCommentVO parentComment = boardCommentMapper.selectByCommentId(comment.getParentId());
            boolean samePostParent =
                    parentComment != null
                            && parentComment.getPostId() != null
                            && parentComment.getPostId().equals(comment.getPostId());
            if (samePostParent) {
                String parentWriterId = parentComment.getUserId();
                if (hasText(parentWriterId) && !parentWriterId.equals(commenterId)) {
                    recipientIds.add(parentWriterId);
                }
            }
        }

        for (String recipientId : recipientIds) {
            System.out.println("댓글 알림 전송 시도 → userId = " + recipientId);

            commentHandler.sendCommentNotification(
                    recipientId,
                    roomId,
                    comment.getPostId(),
                    postTitle,
                    comment.getContent()
            );

            notificationHandler.sendCommentNotification(
                    recipientId,
                    roomId,
                    comment.getPostId(),
                    postTitle,
                    comment.getContent()
            );
        }

        return comment.getCommentId();
    }

    @Override
    public void updateComment(long commentId, String email, String content) {

        String userId = resolveUserIdByEmail(email);

        int updated =
                boardCommentMapper.updateContent(commentId, userId, content);

        if (updated == 0) {
            throw new IllegalStateException("댓글 수정 불가");
        }
    }

    @Override
    public void deleteComment(long commentId, String email) {

        String userId = resolveUserIdByEmail(email);

        int updated =
                boardCommentMapper.softDelete(commentId, userId);

        if (updated == 0) {
            throw new IllegalStateException("댓글 삭제 불가");
        }
    }
}

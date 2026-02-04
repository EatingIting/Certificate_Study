package com.example.demo.board.service;

import com.example.demo.board.handler.CommentNotificationWebSocketHandler;
import com.example.demo.board.mapper.BoardCommentMapper;
import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.로그인.service.AuthService;
import com.example.demo.로그인.vo.AuthVO;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BoardCommentServiceImpl implements BoardCommentService {

    private final BoardCommentMapper boardCommentMapper;
    private final BoardPostMapper boardPostMapper;
    private final AuthService authService;
    private final CommentNotificationWebSocketHandler commentHandler;

    public BoardCommentServiceImpl(
            BoardCommentMapper boardCommentMapper,
            BoardPostMapper boardPostMapper,
            AuthService authService,
            CommentNotificationWebSocketHandler commentHandler
    ) {
        this.boardCommentMapper = boardCommentMapper;
        this.boardPostMapper = boardPostMapper;
        this.authService = authService;
        this.commentHandler = commentHandler;
    }

    private String resolveUserIdByEmail(String email) {
        AuthVO user = authService.findByEmail(email);

        if (user == null) {
            throw new IllegalStateException("유저를 찾을 수 없습니다.");
        }

        return user.getUserId();
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

        if (writerId != null && !writerId.equals(commenterId)) {

            System.out.println("댓글 알림 전송 시도 → writerId = " + writerId);

            commentHandler.sendCommentNotification(
                    writerId,
                    roomId,
                    comment.getPostId(),
                    postTitle,
                    comment.getContent()
            );

            System.out.println("sendCommentNotification 호출 완료");
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

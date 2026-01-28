package com.example.demo.service.board;

import com.example.demo.board.vo.BoardPostDetailVO;
import com.example.demo.board.vo.BoardPostVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BoardDetailServiceImpl implements BoardDetailService {

    private final BoardPostService boardPostService;
    private final BoardAttachmentService boardAttachmentService;
    private final BoardCommentService boardCommentService;

    public BoardDetailServiceImpl(
            BoardPostService boardPostService,
            BoardAttachmentService boardAttachmentService,
            BoardCommentService boardCommentService
    ) {
        this.boardPostService = boardPostService;
        this.boardAttachmentService = boardAttachmentService;
        this.boardCommentService = boardCommentService;
    }

    @Override
    @Transactional
    public BoardPostDetailVO getDetail(long postId, boolean incView) {
        if (incView) {
            boardPostService.incrementViewCount(postId);
        }

        BoardPostVO post = boardPostService.getPostById(postId);
        if (post == null) return null;

        return BoardPostDetailVO.builder()
                .post(post)
                .attachments(boardAttachmentService.getByPostId(postId))
                .comments(boardCommentService.getByPostId(postId))
                .build();
    }

    @Override
    @Transactional
    public long createPostWithAttachments(BoardPostDetailVO detail, String email) {
        if (detail == null || detail.getPost() == null) {
            throw new IllegalArgumentException("게시글 정보가 없습니다.");
        }
        long postId = boardPostService.createPost(detail.getPost(), email);
        boardAttachmentService.addAll(postId, detail.getAttachments());
        return postId;
    }

    @Override
    @Transactional
    public void updatePostAndReplaceAttachments(BoardPostDetailVO detail, String email) {
        if (detail == null || detail.getPost() == null || detail.getPost().getPostId() == null) {
            throw new IllegalArgumentException("게시글 정보가 올바르지 않습니다.");
        }
        long postId = detail.getPost().getPostId();
        boardPostService.updatePost(detail.getPost(), email);
        boardAttachmentService.replaceAll(postId, detail.getAttachments());
    }
}
package com.example.demo.board.service;

import com.example.demo.board.mapper.BoardAttachmentMapper;
import com.example.demo.board.mapper.BoardCommentMapper;
import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.vo.BoardAttachmentVO;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.board.vo.BoardPostVO;
import com.example.demo.dto.BoardAttachmentDTO;
import com.example.demo.dto.BoardCommentDTO;
import com.example.demo.dto.BoardPostDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BoardPostService {

    private final BoardPostMapper postMapper;
    private final BoardAttachmentMapper attachmentMapper;
    private final BoardCommentMapper commentMapper;

    @Transactional
    public BoardPostDTO.DetailResponse getPostDetail(Long postId, boolean increaseView) {

        if (increaseView) {
            postMapper.increaseViewCount(postId);
        }

        BoardPostVO post = postMapper.selectById(postId);
        if (post == null) {
            throw new IllegalStateException("게시글이 존재하지 않습니다.");
        }

        List<BoardAttachmentVO> atts = attachmentMapper.selectByPostId(postId);
        List<BoardCommentVO> comments = commentMapper.selectByPostId(postId);

        return BoardPostDTO.DetailResponse.builder()
                .postId(post.getPostId())
                .roomId(post.getRoomId())
                .userId(post.getUserId())
                .category(post.getCategory())
                .title(post.getTitle())
                .content(post.getContent())
                .isPinned(post.isPinned())
                .viewCount(post.getViewCount() + (increaseView ? 1 : 0)) // 증가 반영(간단 처리)
                .attachments(mapAttachments(atts))
                .comments(mapComments(comments))
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }

    private List<BoardAttachmentDTO.Response> mapAttachments(List<BoardAttachmentVO> atts) {
        List<BoardAttachmentDTO.Response> result = new ArrayList<>();
        if (atts == null) return result;

        for (BoardAttachmentVO a : atts) {
            result.add(BoardAttachmentDTO.Response.builder()
                    .attachmentId(a.getAttachmentId())
                    .postId(a.getPostId())
                    .originalName(a.getOriginalName())
                    .fileKey(a.getFileKey())
                    .url(a.getUrl())
                    .sizeBytes(a.getSizeBytes())
                    .mimeType(a.getMimeType())
                    .createdAt(a.getCreatedAt())
                    .build());
        }
        return result;
    }

    private List<BoardCommentDTO.Response> mapComments(List<BoardCommentVO> comments) {
        List<BoardCommentDTO.Response> result = new ArrayList<>();
        if (comments == null) return result;

        for (BoardCommentVO c : comments) {
            result.add(BoardCommentDTO.Response.builder()
                    .commentId(c.getCommentId())
                    .postId(c.getPostId())
                    .userId(c.getUserId())
                    .content(c.getContent())
                    .createdAt(c.getCreatedAt())
                    .updatedAt(c.getUpdatedAt())
                    .build());
        }
        return result;
    }
}
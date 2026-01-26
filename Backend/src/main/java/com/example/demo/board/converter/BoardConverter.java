package com.example.demo.board.converter;

import com.example.demo.dto.board.attachment.BoardAttachmentRequest;
import com.example.demo.dto.board.attachment.BoardAttachmentResponse;
import com.example.demo.dto.board.comment.BoardCommentCreateRequest;
import com.example.demo.dto.board.comment.BoardCommentResponse;
import com.example.demo.dto.board.detail.BoardPostDetailCreateRequest;
import com.example.demo.dto.board.detail.BoardPostDetailResponse;
import com.example.demo.dto.board.detail.BoardPostDetailUpdateRequest;
import com.example.demo.dto.board.post.BoardPostCreateRequest;
import com.example.demo.dto.board.post.BoardPostResponse;
import com.example.demo.dto.board.post.BoardPostUpdateRequest;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.board.vo.BoardPostAttachmentVO;
import com.example.demo.board.vo.BoardPostDetailVO;
import com.example.demo.board.vo.BoardPostVO;

import java.util.ArrayList;
import java.util.List;

public final class BoardConverter {

    private BoardConverter() {
    }

    // =========================
    // Post: DTO -> VO
    // =========================

    public static BoardPostVO toPostVO(BoardPostCreateRequest dto, String userId) {
        if (dto == null) return null;

        return BoardPostVO.builder()
                .roomId(dto.getRoomId())
                .userId(userId)
                .category(dto.getCategory())
                .title(dto.getTitle())
                .content(dto.getContent())
                .isPinned(dto.getIsPinned())
                .build();
    }

    public static BoardPostVO toPostVO(long postId, BoardPostUpdateRequest dto, String userId) {
        if (dto == null) return null;

        return BoardPostVO.builder()
                .postId(postId)
                .userId(userId)
                .category(dto.getCategory())
                .title(dto.getTitle())
                .content(dto.getContent())
                .build();
    }

    // Detail create/update -> PostVO
    public static BoardPostVO toPostVO(BoardPostDetailCreateRequest dto, String userId) {
        if (dto == null) return null;

        return BoardPostVO.builder()
                .roomId(dto.getRoomId())
                .userId(userId)
                .category(dto.getCategory())
                .title(dto.getTitle())
                .content(dto.getContent())
                .isPinned(dto.getIsPinned())
                .build();
    }

    public static BoardPostVO toPostVO(long postId, BoardPostDetailUpdateRequest dto, String userId) {
        if (dto == null) return null;

        return BoardPostVO.builder()
                .postId(postId)
                .userId(userId)
                .category(dto.getCategory())
                .title(dto.getTitle())
                .content(dto.getContent())
                .build();
    }

    // =========================
    // Post: VO -> DTO
    // =========================

    public static BoardPostResponse toPostResponse(BoardPostVO vo) {
        if (vo == null) return null;

        return BoardPostResponse.builder()
                .postId(vo.getPostId())
                .roomId(vo.getRoomId())
                .userId(vo.getUserId())
                .category(vo.getCategory())
                .title(vo.getTitle())
                .content(vo.getContent())
                .isPinned(vo.getIsPinned())
                .viewCount(vo.getViewCount())
                .createdAt(vo.getCreatedAt())
                .updatedAt(vo.getUpdatedAt())
                .build();
    }

    public static List<BoardPostResponse> toPostResponseList(List<BoardPostVO> vos) {
        List<BoardPostResponse> list = new ArrayList<>();
        if (vos == null) return list;

        for (BoardPostVO vo : vos) {
            BoardPostResponse dto = toPostResponse(vo);
            if (dto != null) list.add(dto);
        }
        return list;
    }

    // =========================
    // Attachment: DTO <-> VO
    // =========================

    public static BoardPostAttachmentVO toAttachmentVO(BoardAttachmentRequest dto) {
        if (dto == null) return null;

        return BoardPostAttachmentVO.builder()
                .originalName(dto.getOriginalName())
                .fileKey(dto.getFileKey())
                .url(dto.getUrl())
                .sizeBytes(dto.getSizeBytes())
                .mimeType(dto.getMimeType())
                .build();
    }

    public static List<BoardPostAttachmentVO> toAttachmentVOList(List<BoardAttachmentRequest> dtos) {
        List<BoardPostAttachmentVO> list = new ArrayList<>();
        if (dtos == null) return list;

        for (BoardAttachmentRequest dto : dtos) {
            BoardPostAttachmentVO vo = toAttachmentVO(dto);
            if (vo != null) list.add(vo);
        }
        return list;
    }

    public static BoardAttachmentResponse toAttachmentResponse(BoardPostAttachmentVO vo) {
        if (vo == null) return null;

        return BoardAttachmentResponse.builder()
                .attachmentId(vo.getAttachmentId())
                .postId(vo.getPostId())
                .originalName(vo.getOriginalName())
                .fileKey(vo.getFileKey())
                .url(vo.getUrl())
                .sizeBytes(vo.getSizeBytes())
                .mimeType(vo.getMimeType())
                .createdAt(vo.getCreatedAt())
                .build();
    }

    public static List<BoardAttachmentResponse> toAttachmentResponseList(List<BoardPostAttachmentVO> vos) {
        List<BoardAttachmentResponse> list = new ArrayList<>();
        if (vos == null) return list;

        for (BoardPostAttachmentVO vo : vos) {
            BoardAttachmentResponse dto = toAttachmentResponse(vo);
            if (dto != null) list.add(dto);
        }
        return list;
    }

    // =========================
    // Comment: DTO <-> VO
    // =========================

    public static BoardCommentVO toCommentVO(long postId, BoardCommentCreateRequest dto, String userId) {
        if (dto == null) return null;

        return BoardCommentVO.builder()
                .postId(postId)
                .userId(userId)
                .content(dto.getContent())
                .build();
    }

    public static BoardCommentResponse toCommentResponse(BoardCommentVO vo) {
        if (vo == null) return null;

        return BoardCommentResponse.builder()
                .commentId(vo.getCommentId())
                .postId(vo.getPostId())
                .userId(vo.getUserId())
                .content(vo.getContent())
                .createdAt(vo.getCreatedAt())
                .updatedAt(vo.getUpdatedAt())
                .build();
    }

    public static List<BoardCommentResponse> toCommentResponseList(List<BoardCommentVO> vos) {
        List<BoardCommentResponse> list = new ArrayList<>();
        if (vos == null) return list;

        for (BoardCommentVO vo : vos) {
            BoardCommentResponse dto = toCommentResponse(vo);
            if (dto != null) list.add(dto);
        }
        return list;
    }

    // =========================
    // Detail: VO -> DTO (상세 응답)
    // =========================

    public static BoardPostDetailResponse toPostDetailResponse(BoardPostDetailVO vo) {
        if (vo == null) return null;

        return BoardPostDetailResponse.builder()
                .post(toPostResponse(vo.getPost()))
                .attachments(toAttachmentResponseList(vo.getAttachments()))
                .comments(toCommentResponseList(vo.getComments()))
                .build();
    }

    // =========================
    // Detail: DTO -> VO (상세 작성/수정용 묶음)
    // =========================

    public static BoardPostDetailVO toDetailVO(BoardPostDetailCreateRequest dto, String userId) {
        if (dto == null) return null;

        BoardPostVO post = toPostVO(dto, userId);
        List<BoardPostAttachmentVO> attachments = toAttachmentVOList(dto.getAttachments());

        return BoardPostDetailVO.builder()
                .post(post)
                .attachments(attachments)
                .build();
    }

    public static BoardPostDetailVO toDetailVO(long postId, BoardPostDetailUpdateRequest dto, String userId) {
        if (dto == null) return null;

        BoardPostVO post = toPostVO(postId, dto, userId);
        List<BoardPostAttachmentVO> attachments = toAttachmentVOList(dto.getAttachments());

        return BoardPostDetailVO.builder()
                .post(post)
                .attachments(attachments)
                .build();
    }
}
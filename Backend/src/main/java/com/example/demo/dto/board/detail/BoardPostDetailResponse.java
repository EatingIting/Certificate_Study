package com.example.demo.dto.board.detail;

import com.example.demo.dto.board.attachment.BoardAttachmentResponse;
import com.example.demo.dto.board.comment.BoardCommentResponse;
import com.example.demo.dto.board.post.BoardPostResponse;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardPostDetailResponse {
    private BoardPostResponse post;
    private List<BoardAttachmentResponse> attachments;
    private List<BoardCommentResponse> comments;
    private boolean canEdit;
    private boolean canDelete;
}
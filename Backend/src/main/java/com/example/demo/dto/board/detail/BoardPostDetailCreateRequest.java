package com.example.demo.dto.board.detail;

import com.example.demo.dto.board.attachment.BoardAttachmentRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardPostDetailCreateRequest {

    @NotBlank
    private String roomId;

    @NotBlank
    private String category;

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    private String content;

    private Boolean isPinned;

    private List<BoardAttachmentRequest> attachments;
}
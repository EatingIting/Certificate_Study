package com.example.demo.dto.board.comment;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardCommentCreateRequest {
    @NotBlank
    private String content;
}
package com.example.demo.dto.board.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardPostCreateRequest {

    @NotBlank
    private String roomId;

    @NotBlank
    private String category; // NOTICE/GENERAL/QNA/RESOURCE

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    private String content;

    private Boolean isPinned;
}
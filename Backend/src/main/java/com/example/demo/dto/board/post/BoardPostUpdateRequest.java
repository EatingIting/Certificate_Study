package com.example.demo.dto.board.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardPostUpdateRequest {

    @NotBlank
    private String category;

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    private String content;

    private Boolean isPinned;
}

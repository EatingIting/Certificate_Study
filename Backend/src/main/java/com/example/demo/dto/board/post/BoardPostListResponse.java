package com.example.demo.dto.board.post;


import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardPostListResponse {
    private List<BoardPostResponse> items;
    private int page;
    private int size;
    private int total;
    private int totalPages;
}

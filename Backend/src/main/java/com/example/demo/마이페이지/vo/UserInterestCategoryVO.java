package com.example.demo.마이페이지.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UserInterestCategoryVO {

    private String userId;
    private Long categoryId;
    private LocalDateTime createdAt;
}

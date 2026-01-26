package com.example.demo.userinterestcategory;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UserInterestCategoryVO {

    private String userId;
    private Long categoryId;
    private LocalDateTime createdAt;
}

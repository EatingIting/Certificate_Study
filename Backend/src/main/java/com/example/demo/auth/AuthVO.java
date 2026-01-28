package com.example.demo.auth;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class AuthVO {

    private String userId;
    private String email;
    private String password;
    private String name;
    private String nickname;
    private LocalDate birthDate;
    private String gender; // MALE / FEMALE
    private String introduction;
    private LocalDateTime createdAt;

    private List<Long> interestCategoryIds;
}

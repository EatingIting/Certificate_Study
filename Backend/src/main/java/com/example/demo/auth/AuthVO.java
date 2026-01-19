package com.example.demo.auth;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AuthVO {

    private String userId;
    private String email;
    private String password;
    private String name;
    private String nickname;
    private Integer age;
    private String gender; // MALE / FEMALE
    private String introduction;
    private LocalDateTime createdAt;
}

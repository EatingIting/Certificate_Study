package com.example.demo.auth;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
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

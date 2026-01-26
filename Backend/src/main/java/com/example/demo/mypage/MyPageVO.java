package com.example.demo.mypage;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class MyPageVO {

    private String userId;
    private String name;
    private String nickname;
    private String email;
    private LocalDate birthDate;
    private String gender;
    private String introduction;
    private String profileImg;
    private LocalDateTime createdAt;


}

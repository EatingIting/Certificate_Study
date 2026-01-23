package com.example.demo.mypage;

import org.springframework.web.multipart.MultipartFile;

public interface MyPageService {

    MyPageVO getMyPage(String userId);

    void updateMyPage(
            String userId,
            String name,
            String nickname,
            String birthDate,
            String introduction,
            MultipartFile profileImage
    );

    void withdraw(String email);
}

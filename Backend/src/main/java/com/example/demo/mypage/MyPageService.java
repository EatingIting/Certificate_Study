package com.example.demo.mypage;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;

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

    // 성별 조회
    String getGender(String email);

    List<MyStudyVO> getJoinedStudies(String email);

    List<MyStudyVO> getCompletedStudies(String email);
}

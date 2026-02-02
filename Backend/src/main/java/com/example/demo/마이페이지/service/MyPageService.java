package com.example.demo.마이페이지.service;

import com.example.demo.마이페이지.vo.MyPageVO;
import com.example.demo.마이페이지.vo.MyStudyVO;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface MyPageService {

    MyPageVO getMyPage(String userId);

    void updateMyPage(
            String userId,
            String name,
            String nickname,
            String birthDate,
            String gender,
            String introduction,
            MultipartFile profileImage
    );

    void withdraw(String email);

    // 성별 조회
    String getGender(String email);

    List<MyStudyVO> getJoinedStudies(String email);

    List<MyStudyVO> getCompletedStudies(String email);
}

package com.example.demo.마이페이지.service;

import com.example.demo.s3.S3Uploader;
import com.example.demo.마이페이지.mapper.MyPageMapper;
import com.example.demo.마이페이지.vo.MyPageVO;
import com.example.demo.마이페이지.vo.MyStudyVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class MyPageServiceImpl implements MyPageService {

    private final MyPageMapper myPageMapper;
    private final S3Uploader s3Uploader;

    @Override
    public MyPageVO getMyPage(String userId) {
        return myPageMapper.findByUserId(userId);
    }

    @Override
    public void updateMyPage(
            String userId,
            String name,
            String nickname,
            String birthDate,
            String gender,
            String introduction,
            MultipartFile profileImage
    ) {

        String profileImgUrl = null;

        if (profileImage != null && !profileImage.isEmpty()) {
            try {
                profileImgUrl = s3Uploader.upload(profileImage);
            } catch (Exception e) {
                throw new RuntimeException("프로필 이미지 업로드 실패", e);
            }
        }

        myPageMapper.updateMyPage(
                userId,
                name,
                nickname,
                LocalDate.parse(birthDate),
                gender,
                introduction,
                profileImgUrl
        );
    }

    @Override
    public void withdraw(String email) {
        myPageMapper.deleteByEmail(email);
    }

    @Override
    public String getGender(String email) {
        return myPageMapper.getGender(email);
    }

    @Override
    public List<MyStudyVO> getJoinedStudies(String email) {
        return myPageMapper.getJoinedStudies(email);
    }

    @Override
    public List<MyStudyVO> getCompletedStudies(String email) {
        return myPageMapper.getCompletedStudies(email);
    }
}

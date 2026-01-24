package com.example.demo.mypage;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class MyPageServiceImpl implements MyPageService {

    private final MyPageMapper myPageMapper;

    private static final String UPLOAD_DIR =
            "C:/upload/profile/";

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
            String introduction,
            MultipartFile profileImage
    ) {
        String profileImgPath = null;

        if (profileImage != null && !profileImage.isEmpty()) {
            try {
                File dir = new File(UPLOAD_DIR);
                if (!dir.exists()) {
                    dir.mkdirs();
                }

                String fileName =
                        UUID.randomUUID() + "_" + profileImage.getOriginalFilename();

                File target = new File(dir, fileName);
                profileImage.transferTo(target);

                profileImgPath = "/uploads/profile/" + fileName;

            } catch (Exception e) {
                throw new RuntimeException("프로필 이미지 저장 실패", e);
            }
        }

        myPageMapper.updateMyPage(
                userId,
                name,
                nickname,
                LocalDate.parse(birthDate),
                introduction,
                profileImgPath
        );
    }

    @Override
    public void withdraw(String email) {
        myPageMapper.deleteByEmail(email);
    }

    // 성별 조회 추가
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

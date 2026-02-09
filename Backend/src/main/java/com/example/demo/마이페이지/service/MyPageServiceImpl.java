package com.example.demo.마이페이지.service;

import com.example.demo.s3.S3Uploader;
import com.example.demo.로그인.mapper.AuthMapper;
import com.example.demo.로그인.vo.AuthVO;
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
    private final AuthMapper authMapper;

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
    @Transactional
    public void withdraw(String email) {

        AuthVO user = authMapper.findByEmail(email);
        if (user == null) {
            throw new IllegalStateException("사용자를 찾을 수 없습니다.");
        }

        String userId = user.getUserId();

        // 방장 여부 체크
        int hostRoomCount = myPageMapper.countRoomsByHost(email);
        if (hostRoomCount > 0) {
            throw new IllegalStateException("방장을 위임하지 않은 스터디가 있어 탈퇴할 수 없습니다.");
        }

        // FK 삭제 (email 기준) - 요청하신 순서대로 room_join_request 먼저 삭제
        myPageMapper.deleteJoinRequestByRequester(email);
        myPageMapper.deleteJoinRequestByHost(email);

        // FK 삭제 (user_id 기준)
        myPageMapper.deleteBoardCommentsByUser(userId);
        myPageMapper.deleteBoardPostsByUser(userId);
        myPageMapper.deleteChatParticipantsByUser(userId);
        myPageMapper.deleteChatMessagesByUser(userId);
        myPageMapper.deleteRoomParticipantsByUser(userId);
        myPageMapper.deleteSchedulesByUser(userId);
        myPageMapper.deleteUserInterestCategory(userId);

        // 마지막 users 삭제
        myPageMapper.deleteUser(userId);
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

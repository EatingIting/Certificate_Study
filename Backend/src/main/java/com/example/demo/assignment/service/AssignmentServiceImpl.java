package com.example.demo.assignment.service;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.mapper.AssignmentMapper;
import com.example.demo.assignment.vo.AssignmentSubmissionVO;
import com.example.demo.assignment.vo.AssignmentVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.example.demo.assignment.dto.AssignmentSubmissionDetailResponse;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import com.example.demo.s3.S3Uploader;


@Service
@RequiredArgsConstructor
public class AssignmentServiceImpl implements AssignmentService {

    private final AssignmentMapper assignmentMapper;
    private final S3Uploader s3Uploader;



    @Override
    public List<AssignmentListResponse> getAssignments(String roomId, String userEmail) {
        return assignmentMapper.selectAssignmentsByRoom(roomId, userEmail);
    }
    @Override
    public Long createAssignment(String roomId, AssignmentCreateRequest req, String createdByEmail) {
        AssignmentVO vo = new AssignmentVO();
        vo.setRoomId(roomId);
        vo.setTitle(req.getTitle());
        vo.setDescription(req.getDescription());
        vo.setDueAt(req.getDueAt());
        vo.setCreatedByEmail(createdByEmail);

        assignmentMapper.insertAssignment(vo);
        return vo.getAssignmentId();
    }



    @Override
    public void submitAssignment(Long assignmentId, String userEmail, String submitTitle, String memo, MultipartFile file) {
        AssignmentSubmissionVO vo = new AssignmentSubmissionVO();
        vo.setAssignmentId(assignmentId);
        vo.setUserEmail(userEmail);
        vo.setSubmitTitle(submitTitle);
        vo.setMemo(memo);

        if (file != null && !file.isEmpty()) {
            try {
                String s3Url = s3Uploader.upload(file);   // ✅ S3 업로드
                vo.setFileName(file.getOriginalFilename());
                vo.setFileSize(file.getSize());
                vo.setFileUrl(s3Url);                    // ✅ DB에는 S3 URL 저장
            } catch (Exception e) {
                throw new RuntimeException("S3 업로드 실패", e);
            }
        }

        assignmentMapper.upsertSubmission(vo);

    }

    @Override
    public List<AssignmentSubmissionDetailResponse> getSubmissionDetails(Long assignmentId) {
        return assignmentMapper.selectSubmissionDetails(assignmentId);
    }
}

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

@Service
@RequiredArgsConstructor
public class AssignmentServiceImpl implements AssignmentService {

    private final AssignmentMapper assignmentMapper;

    // 로컬 저장 폴더 (원하면 yml로 빼도 됨)
    private final String uploadDir = "uploads";

    @Override
    public List<AssignmentListResponse> getAssignments(String roomId, String userId) {
        return assignmentMapper.selectAssignmentsByRoom(roomId, userId);
    }
    @Override
    public Long createAssignment(String roomId, AssignmentCreateRequest req) {
        AssignmentVO vo = new AssignmentVO();
        vo.setRoomId(roomId);
        vo.setTitle(req.getTitle());
        vo.setDescription(req.getDescription());
        vo.setDueAt(req.getDueAt());
        vo.setCreatedByUserId(req.getCreatedByUserId());

        assignmentMapper.insertAssignment(vo); // 여기서 DB INSERT 실행 + PK가 vo.assignmentId에 채워짐
        return vo.getAssignmentId();
    }


    @Override
    public void submitAssignment(Long assignmentId, String userId, String submitTitle, String memo, MultipartFile file) {
        AssignmentSubmissionVO vo = new AssignmentSubmissionVO();
        vo.setAssignmentId(assignmentId);
        vo.setUserId(userId);
        vo.setSubmitTitle(submitTitle);
        vo.setMemo(memo);

        if (file != null && !file.isEmpty()) {
            try {
                // uploads 폴더 없으면 생성
                File dir = new File(uploadDir);
                if (!dir.exists()) dir.mkdirs();

                String originalName = file.getOriginalFilename();
                String safeName = UUID.randomUUID() + "_" + (originalName == null ? "file" : originalName);

                Path target = Path.of(uploadDir, safeName);
                Files.write(target, file.getBytes());

                vo.setFileName(originalName);
                vo.setFileSize(file.getSize());

                // 브라우저에서 접근할 URL (아래 8단계에서 /files/** 매핑해줄거임)
                vo.setFileUrl("/files/" + safeName);

            } catch (Exception e) {
                throw new RuntimeException("파일 저장 실패", e);
            }
        }

        assignmentMapper.upsertSubmission(vo);
    }

    @Override
    public List<AssignmentSubmissionDetailResponse> getSubmissionDetails(Long assignmentId) {
        return assignmentMapper.selectSubmissionDetails(assignmentId);
    }
}

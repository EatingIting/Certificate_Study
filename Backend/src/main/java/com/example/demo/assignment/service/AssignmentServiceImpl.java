package com.example.demo.assignment.service;

import com.example.demo.assignment.dto.AssignmentCreateRequest;
import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.mapper.AssignmentMapper;
import com.example.demo.assignment.vo.AssignmentSubmissionVO;
import com.example.demo.assignment.vo.AssignmentVO;
import com.example.demo.notification.LmsNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import com.example.demo.assignment.dto.AssignmentSubmissionDetailResponse;

import java.util.List;
import com.example.demo.s3.S3Uploader;
import com.example.demo.assignment.dto.*;
import java.util.*;
import java.util.stream.Collectors;
import com.example.demo.assignment.dto.AssignmentMatrixResponse;



@Service
@RequiredArgsConstructor
public class AssignmentServiceImpl implements AssignmentService {

    private final AssignmentMapper assignmentMapper;
    private final S3Uploader s3Uploader;
    private final LmsNotificationService lmsNotificationService;



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

        lmsNotificationService.notifyAssignmentCreated(
                roomId,
                vo.getAssignmentId(),
                vo.getTitle(),
                createdByEmail
        );

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

    @Override
    public AssignmentMatrixResponse getSubmissionMatrix(String roomId) {
        List<AssignmentMatrixAssignment> assignments = assignmentMapper.selectMatrixAssignments(roomId);
        List<AssignmentMatrixRow> flat = assignmentMapper.selectMatrixRows(roomId);

        // userId 기준으로 그룹화
        Map<String, List<AssignmentMatrixRow>> byUser = flat.stream()
                .collect(Collectors.groupingBy(AssignmentMatrixRow::getUserId, LinkedHashMap::new, Collectors.toList()));

        List<AssignmentMatrixMember> members = new ArrayList<>();

        for (Map.Entry<String, List<AssignmentMatrixRow>> entry : byUser.entrySet()) {
            String userId = entry.getKey();
            List<AssignmentMatrixRow> rows = entry.getValue();

            String name = rows.get(0).getMemberName();

            // assignmentId -> row (제출정보)
            Map<Long, AssignmentMatrixRow> byAid = new HashMap<>();
            for (AssignmentMatrixRow r : rows) {
                byAid.put(r.getAssignmentId(), r);
            }

            List<AssignmentMatrixCell> submissions = new ArrayList<>();
            for (AssignmentMatrixAssignment a : assignments) {
                AssignmentMatrixRow r = byAid.get(a.getAssignmentId());
                boolean submitted = (r != null && r.getSubmissionId() != null);

                submissions.add(new AssignmentMatrixCell(
                        a.getAssignmentId(),
                        submitted,
                        r != null ? r.getSubmittedAt() : null,
                        r != null ? r.getFileUrl() : null
                ));
            }

            members.add(new AssignmentMatrixMember(userId, name, submissions));
        }

        return new AssignmentMatrixResponse(assignments, members);
    }

    @Override
    @Transactional
    public void deleteAssignment(Long assignmentId, String requesterEmail) {
        String authorEmail = assignmentMapper.selectCreatedByEmail(assignmentId);

        if (authorEmail == null || authorEmail.isBlank()) {
            throw new IllegalArgumentException("삭제할 과제를 찾을 수 없습니다.");
        }

        if (requesterEmail == null || !authorEmail.trim().equalsIgnoreCase(requesterEmail.trim())) {
            throw new AccessDeniedException("본인이 생성한 과제만 삭제할 수 있습니다.");
        }

        assignmentMapper.deleteSubmissionsByAssignmentId(assignmentId);

        int deleted = assignmentMapper.deleteAssignmentByIdAndAuthor(assignmentId, requesterEmail);
        if (deleted == 0) {
            throw new IllegalStateException("과제 삭제에 실패했습니다.");
        }
    }

}

package com.example.demo.assignment.mapper;

import com.example.demo.assignment.dto.*;
import com.example.demo.assignment.vo.AssignmentSubmissionVO;
import com.example.demo.assignment.vo.AssignmentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;



@Mapper
public interface AssignmentMapper {

    List<AssignmentListResponse> selectAssignmentsByRoom(
            @Param("roomId") String roomId,
            @Param("userEmail") String userEmail
    );

    List<AssignmentSubmissionDetailResponse> selectSubmissionDetails(
            @Param("assignmentId") Long assignmentId
    );

    /** 제출물 파일 정보 조회 (AI 연동: file_url, file_name) */
    AssignmentSubmissionFileDto selectSubmissionFileBySubmissionId(@Param("submissionId") Long submissionId);

    // ✅ matrix header (과제 목록)
    List<AssignmentMatrixAssignment> selectMatrixAssignments(@Param("roomId") String roomId);

    // ✅ matrix body (멤버 x 과제 제출 row들)
    List<AssignmentMatrixRow> selectMatrixRows(@Param("roomId") String roomId);

    int insertAssignment(AssignmentVO vo);

    int upsertSubmission(AssignmentSubmissionVO vo);

    String selectCreatedByEmail(@Param("assignmentId") Long assignmentId);

    int deleteSubmissionsByAssignmentId(@Param("assignmentId") Long assignmentId);

    int deleteAssignmentByIdAndAuthor(
            @Param("assignmentId") Long assignmentId,
            @Param("authorEmail") String authorEmail
    );
}

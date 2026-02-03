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

    // ✅ matrix header (과제 목록)
    List<AssignmentMatrixAssignment> selectMatrixAssignments(@Param("roomId") String roomId);

    // ✅ matrix body (멤버 x 과제 제출 row들)
    List<AssignmentMatrixRow> selectMatrixRows(@Param("roomId") String roomId);

    int insertAssignment(AssignmentVO vo);

    int upsertSubmission(AssignmentSubmissionVO vo);
}


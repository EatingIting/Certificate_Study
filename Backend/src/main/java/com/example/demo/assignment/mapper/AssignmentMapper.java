package com.example.demo.assignment.mapper;

import com.example.demo.assignment.dto.AssignmentListResponse;
import com.example.demo.assignment.dto.AssignmentSubmissionDetailResponse;
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


    int insertAssignment(AssignmentVO vo);

    int upsertSubmission(AssignmentSubmissionVO vo);
}

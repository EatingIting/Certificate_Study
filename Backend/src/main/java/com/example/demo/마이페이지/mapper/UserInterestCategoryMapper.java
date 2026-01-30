package com.example.demo.마이페이지.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserInterestCategoryMapper {

    // 관심카테고리 저장
    void insertInterestCategory(
            @Param("userId") String userId,
            @Param("categoryId") Long categoryId
    );

    // 관심카테고리 전체 삭제 (마이페이지 수정용)
    void deleteByUserId(String userId);

    // 관심카테고리 조회
    List<Long> findCategoryIdsByUserId(String userId);
}

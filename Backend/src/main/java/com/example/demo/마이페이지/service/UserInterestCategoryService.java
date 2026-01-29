package com.example.demo.마이페이지.service;

import java.util.List;

public interface UserInterestCategoryService {

    // 관심카테고리 저장
    void saveInterestCategories(String userId, List<Long> categoryIds);

    // 관심카테고리 수정 (삭제 후 재등록)
    void updateInterestCategories(String userId, List<Long> categoryIds);

    // 관심카테고리 조회
    List<Long> getInterestCategories(String userId);
}

package com.example.demo.userinterestcategory;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class UserInterestCategoryImpl implements UserInterestCategoryService {

    private final UserInterestCategoryMapper mapper;

    // 저장 (회원가입 시)
    @Override
    public void saveInterestCategories(String userId, List<Long> categoryIds) {

        if (categoryIds == null || categoryIds.isEmpty()) return;

        if (categoryIds.size() > 4) {
            throw new IllegalArgumentException("관심 카테고리는 최대 4개까지 가능합니다.");
        }

        for (Long categoryId : categoryIds) {
            mapper.insertInterestCategory(userId, categoryId);
        }
    }

    // 수정 (마이페이지)
    @Override
    public void updateInterestCategories(String userId, List<Long> categoryIds) {

        if (categoryIds == null) return;

        if (categoryIds.size() > 4) {
            throw new IllegalArgumentException("관심 카테고리는 최대 4개까지 가능합니다.");
        }

        // 기존 삭제
        mapper.deleteByUserId(userId);

        // 새로 저장
        for (Long categoryId : categoryIds) {
            mapper.insertInterestCategory(userId, categoryId);
        }
    }

    // 조회
    @Override
    public List<Long> getInterestCategories(String userId) {
        return mapper.findCategoryIdsByUserId(userId);
    }
}

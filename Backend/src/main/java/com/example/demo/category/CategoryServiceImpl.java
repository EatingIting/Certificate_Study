package com.example.demo.category;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryMapper categoryMapper;

    @Override
    public List<CategoryVO> getAllCategories() {
        return categoryMapper.selectAllCategories();
    }

    @Override
    public List<CategoryVO> getMainCategories() {
        return categoryMapper.selectByLevel(1);
    }

    @Override
    public List<CategoryVO> getChildren(Long parentId) {
        return categoryMapper.selectByParentId(parentId);
    }
}
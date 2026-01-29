package com.example.demo.모집.service;

import java.util.List;

import com.example.demo.모집.mapper.CategoryMapper;
import com.example.demo.모집.vo.CategoryVO;
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
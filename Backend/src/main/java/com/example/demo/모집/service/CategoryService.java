package com.example.demo.모집.service;

import com.example.demo.모집.vo.CategoryVO;

import java.util.List;

public interface CategoryService {

    List<CategoryVO> getAllCategories();

    List<CategoryVO> getMainCategories();

    List<CategoryVO> getChildren(Long parentId);
}
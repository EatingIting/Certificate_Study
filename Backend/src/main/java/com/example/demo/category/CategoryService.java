package com.example.demo.category;

import java.util.List;

public interface CategoryService {

    List<CategoryVO> getAllCategories();

    List<CategoryVO> getMainCategories();

    List<CategoryVO> getChildren(Long parentId);
}
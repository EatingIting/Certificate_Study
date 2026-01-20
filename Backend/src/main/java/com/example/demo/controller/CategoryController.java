package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.category.CategoryService;
import com.example.demo.category.CategoryVO;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CategoryController {

    private final CategoryService categoryService;

    /** 전체 카테고리 */
    @GetMapping
    public List<CategoryVO> all() {
        return categoryService.getAllCategories();
    }

    /** 대분류 */
    @GetMapping("/main")
    public List<CategoryVO> main() {
        return categoryService.getMainCategories();
    }

    /** 하위 카테고리 */
    @GetMapping("/{parentId}/children")
    public List<CategoryVO> children(@PathVariable Long parentId) {
        return categoryService.getChildren(parentId);
    }
}

package com.example.demo.category;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CategoryMapper {

    List<CategoryVO> selectAllCategories();

    List<CategoryVO> selectByLevel(int level);

    List<CategoryVO> selectByParentId(Long parentId);
}
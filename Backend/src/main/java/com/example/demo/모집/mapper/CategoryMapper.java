package com.example.demo.모집.mapper;

import java.util.List;

import com.example.demo.모집.vo.CategoryVO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CategoryMapper {

    List<CategoryVO> selectAllCategories();

    List<CategoryVO> selectByLevel(int level);

    List<CategoryVO> selectByParentId(Long parentId);
}
package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardCommentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface BoardCommentMapper {

    List<BoardCommentVO> selectByPostId(@Param("postId") Long postId);
}

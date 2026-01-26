package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardCommentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface BoardCommentMapper {

    List<BoardCommentVO> selectByPostId(
            @Param("postId") long postId
    );

    int insert(BoardCommentVO comment);

    int updateContent(
            @Param("commentId") long commentId,
            @Param("userId") String userId,
            @Param("content") String content
    );

    int softDelete(
            @Param("commentId") long commentId,
            @Param("userId") String userId
    );
}
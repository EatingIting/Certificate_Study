package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardPostVO;
import com.example.demo.dto.BoardCategory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface BoardPostMapper {

    List<BoardPostVO> selectList(
            @Param("roomId") String roomId,
            @Param("category") BoardCategory category,
            @Param("size") int size,
            @Param("cursor") Long cursor
    );

    long countComments(@Param("postId") Long postId);

    long countAttachments(@Param("postId") Long postId);

    BoardPostVO selectById(@Param("postId") Long postId);

    int increaseViewCount(@Param("postId") Long postId);
}

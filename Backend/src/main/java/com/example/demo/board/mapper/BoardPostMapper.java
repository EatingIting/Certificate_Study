package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardPostVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface BoardPostMapper {

    List<BoardPostVO> selectPostList(
            @Param("roomId") String roomId,
            @Param("category") String category,
            @Param("keyword") String keyword,
            @Param("offset") int offset,
            @Param("size") int size
    );

    int countPostList(
            @Param("roomId") String roomId,
            @Param("category") String category,
            @Param("keyword") String keyword
    );

    BoardPostVO selectPostById(
            @Param("postId") long postId
    );

    int incrementViewCount(@Param("postId") long postId);

    int insertPost(BoardPostVO post);

    int updatePost(BoardPostVO post);

    int softDeletePost(
            @Param("postId") long postId,
            @Param("userId") String userId
    );

    int updatePinned(
            @Param("postId") long postId,
            @Param("userId") String userId,
            @Param("isPinned") boolean isPinned
    );
}
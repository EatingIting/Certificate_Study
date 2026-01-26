package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardCommentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface BoardCommentMapper {

    @Select("SELECT * FROM board_comments WHERE post_id = #{postId} AND deleted_at IS NULL ORDER BY comment_id ASC")
    @Results({
        @Result(property = "commentId", column = "comment_id", id = true),
        @Result(property = "postId", column = "post_id"),
        @Result(property = "userId", column = "user_id"),
        @Result(property = "content", column = "content"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "updatedAt", column = "updated_at"),
        @Result(property = "deletedAt", column = "deleted_at")
    })
    List<BoardCommentVO> selectByPostId(@Param("postId") Long postId);
}

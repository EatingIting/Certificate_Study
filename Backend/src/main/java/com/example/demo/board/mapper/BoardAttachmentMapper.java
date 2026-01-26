package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardPostAttachmentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface BoardAttachmentMapper {

    List<BoardPostAttachmentVO> selectByPostId(@Param("postId") long postId);

    int insert(BoardPostAttachmentVO attachment);

    int deleteByPostId(@Param("postId") long postId);
}

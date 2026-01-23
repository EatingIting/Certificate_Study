package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardAttachmentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface BoardAttachmentMapper {

    List <BoardAttachmentVO> selectByPostId(@Param("postId") Long postId);
}

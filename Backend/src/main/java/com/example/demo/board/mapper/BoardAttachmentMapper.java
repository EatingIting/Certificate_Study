package com.example.demo.board.mapper;

import com.example.demo.board.vo.BoardAttachmentVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface BoardAttachmentMapper {

    @Select("SELECT * FROM board_attachments WHERE post_id = #{postId} ORDER BY attachment_id ASC")
    @Results({
        @Result(property = "attachmentId", column = "attachment_id", id = true),
        @Result(property = "postId", column = "post_id"),
        @Result(property = "originalName", column = "original_name"),
        @Result(property = "fileKey", column = "file_key"),
        @Result(property = "url", column = "url"),
        @Result(property = "sizeBytes", column = "size_bytes"),
        @Result(property = "mimeType", column = "mime_type"),
        @Result(property = "createdAt", column = "created_at")
    })
    List<BoardAttachmentVO> selectByPostId(@Param("postId") Long postId);
}

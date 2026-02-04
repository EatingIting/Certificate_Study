package com.example.demo.board.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.ibatis.type.Alias;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Alias("BoardPostDetailVO")
public class BoardPostDetailVO {

    private BoardPostVO post;
    private List<BoardPostAttachmentVO> attachments;
    private List<BoardCommentVO> comments;

    private boolean canEdit;
    private boolean canDelete;
}
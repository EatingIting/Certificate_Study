package com.example.demo.board.service;

import com.example.demo.board.vo.BoardPostAttachmentVO;

import java.util.List;

public interface BoardAttachmentService {

    List<BoardPostAttachmentVO> getByPostId(long postId);

    void addAll(long postId, List<BoardPostAttachmentVO> attachments);

    void replaceAll(long postId, List<BoardPostAttachmentVO> attachments);

    void deleteByPostId(long postId);
}
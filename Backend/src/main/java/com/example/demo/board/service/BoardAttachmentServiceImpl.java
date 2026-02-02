package com.example.demo.board.service;

import com.example.demo.board.mapper.BoardAttachmentMapper;
import com.example.demo.board.vo.BoardPostAttachmentVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BoardAttachmentServiceImpl implements BoardAttachmentService {

    private final BoardAttachmentMapper boardAttachmentMapper;

    public BoardAttachmentServiceImpl(BoardAttachmentMapper boardAttachmentMapper) {
        this.boardAttachmentMapper = boardAttachmentMapper;
    }

    @Override
    public List<BoardPostAttachmentVO> getByPostId(long postId) {
        return boardAttachmentMapper.selectByPostId(postId);
    }

    @Override
    @Transactional
    public void addAll(long postId, List<BoardPostAttachmentVO> attachments) {
        if (attachments == null || attachments.isEmpty()) return;

        for (BoardPostAttachmentVO att : attachments) {
            att.setPostId(postId);
            boardAttachmentMapper.insert(att);
        }
    }

    @Override
    @Transactional
    public void replaceAll(long postId, List<BoardPostAttachmentVO> attachments) {
        boardAttachmentMapper.deleteByPostId(postId);
        addAll(postId, attachments);
    }

    @Override
    public void deleteByPostId(long postId) {
        boardAttachmentMapper.deleteByPostId(postId);
    }
}
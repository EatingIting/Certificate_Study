package com.example.demo.board.service;

import com.example.demo.board.vo.BoardPostDetailVO;

public interface BoardDetailService {

    BoardPostDetailVO getDetail(long postId, boolean incView, String email);

    long createPostWithAttachments(BoardPostDetailVO detail, String email);

    void updatePostAndReplaceAttachments(BoardPostDetailVO detail, String email);
}
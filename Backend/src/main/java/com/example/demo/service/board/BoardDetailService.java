package com.example.demo.service.board;

import com.example.demo.board.vo.BoardPostDetailVO;

public interface BoardDetailService {

    BoardPostDetailVO getDetail(long postId, boolean incView);

    long createPostWithAttachments(BoardPostDetailVO detail);

    void updatePostAndReplaceAttachments(BoardPostDetailVO detail);
}
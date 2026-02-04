package com.example.demo.board.service;

import com.example.demo.dto.board.attachment.BoardAttachmentRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface BoardUploadService {
    List<BoardAttachmentRequest> upload(
            String roomId,
            Long postId,
            List<MultipartFile> files
    );
}

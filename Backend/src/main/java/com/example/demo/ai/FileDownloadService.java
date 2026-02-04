package com.example.demo.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileDownloadService {

    private static final List<String> ALLOWED_IMAGE_TYPES =
            Arrays.asList("jpeg", "jpg", "png", "gif", "webp");
    private static final String PDF_EXT = "pdf";

    private final RestTemplate restTemplate;

    public byte[] download(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new IllegalArgumentException("fileUrl이 없습니다.");
        }
        try {
            byte[] body = restTemplate.getForObject(fileUrl, byte[].class);
            if (body == null || body.length == 0) {
                throw new IllegalArgumentException("파일 내용이 비어 있습니다.");
            }
            return body;
        } catch (Exception e) {
            log.warn("파일 다운로드 실패: {} - {}", fileUrl, e.getMessage());
            throw new RuntimeException("파일을 불러올 수 없습니다: " + e.getMessage());
        }
    }

    public static boolean isPdf(String fileName) {
        if (fileName == null) return false;
        return fileName.toLowerCase().endsWith(".pdf");
    }

    public static boolean isImage(String fileName) {
        if (fileName == null) return false;
        String ext = fileName.contains(".") ? fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase() : "";
        return ALLOWED_IMAGE_TYPES.contains(ext);
    }
}

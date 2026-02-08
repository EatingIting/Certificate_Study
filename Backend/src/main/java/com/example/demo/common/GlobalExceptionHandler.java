package com.example.demo.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @Value("${spring.servlet.multipart.max-file-size:100MB}")
    private String maxFileSize;

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceeded(
            MaxUploadSizeExceededException ex,
            HttpServletRequest request
    ) {
        return payloadTooLargeResponse(request);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<Map<String, Object>> handleMultipartException(
            MultipartException ex,
            HttpServletRequest request
    ) {
        if (isPayloadTooLarge(ex)) {
            return payloadTooLargeResponse(request);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("message", "파일 업로드 중 오류가 발생했습니다.");
        body.put("path", request.getRequestURI());
        return ResponseEntity.badRequest().body(body);
    }

    private ResponseEntity<Map<String, Object>> payloadTooLargeResponse(HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", HttpStatus.PAYLOAD_TOO_LARGE.value());
        body.put("message", "파일이 너무 큽니다. " + normalizeLimit(maxFileSize) + "이하만 넣어주세요.");
        body.put("maxFileSize", normalizeLimit(maxFileSize));
        body.put("path", request.getRequestURI());
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(body);
    }

    private boolean isPayloadTooLarge(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof MaxUploadSizeExceededException) {
                return true;
            }
            String className = current.getClass().getName().toLowerCase(Locale.ROOT);
            String message = String.valueOf(current.getMessage()).toLowerCase(Locale.ROOT);
            if (className.contains("sizelimitexceeded")
                    || className.contains("maxuploadsize")
                    || message.contains("too large")
                    || message.contains("request entity too large")
                    || (message.contains("size") && message.contains("exceed"))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String normalizeLimit(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return "100MB";
        }
        return rawValue.trim().toUpperCase(Locale.ROOT).replace(" ", "");
    }
}

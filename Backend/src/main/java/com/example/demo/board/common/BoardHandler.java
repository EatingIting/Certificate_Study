package com.example.demo.board.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class BoardHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>>  handleAccessDenied(
            AccessDeniedException e,
            HttpServletRequest request
    ) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", 403);
        body.put("error", "FORBIDDEN");
        body.put("message", e.getMessage());  // ✅ "스터디원만 접근 가능합니다."
        body.put("path", request.getRequestURI());

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }
}

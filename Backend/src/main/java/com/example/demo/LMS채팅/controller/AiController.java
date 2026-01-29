package com.example.demo.LMS채팅.controller;

import com.example.demo.LMS채팅.service.OpenAiService; // 👈 import 변경
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final OpenAiService openAiService; // 👈 이름 변경

    @PostMapping("/chat")
    public ResponseEntity<String> chat(@RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        // String subject = request.get("subject"); // 필요하면 주제도 프롬프트에 섞어서 전달 가능

        String answer = openAiService.getContents(userMessage);
        return ResponseEntity.ok(answer);
    }
}
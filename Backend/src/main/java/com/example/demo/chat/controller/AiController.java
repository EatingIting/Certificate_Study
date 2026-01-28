package com.example.demo.chat.controller;

import com.example.demo.chat.service.GeminiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final GeminiService geminiService; // 👈 이게 있어야 함

    @PostMapping("/chat")
    public String chatWithAi(@RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        String subject = request.getOrDefault("subject", "IT 지식 전문가");

        // 🚨 중요: 소문자 geminiService로 호출해야 합니다!
        return geminiService.getContents(userMessage, subject);
    }
}
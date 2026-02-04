package com.example.demo.chat.controller;

import com.example.demo.ai.AiSubmissionService;
import com.example.demo.chat.service.OpenAiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final OpenAiService openAiService;
    private final AiSubmissionService aiSubmissionService;

    @PostMapping("/chat")
    public ResponseEntity<String> chat(@RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        String answer = openAiService.getContents(userMessage);
        return ResponseEntity.ok(answer);
    }

    /**
     * 제출물(submissionId)을 자동으로 다운로드해 AI가 읽고 답변 (이미지 → Vision, PDF → 텍스트 추출 후 채팅)
     * Body: { "message": "이 과제 피드백해줘", "submissionId": "123" }
     */
    @PostMapping("/chat/with-submission")
    public ResponseEntity<String> chatWithSubmission(@RequestBody Map<String, String> request) {
        String message = request.get("message");
        String submissionIdStr = request.get("submissionId");
        if (submissionIdStr == null || submissionIdStr.isBlank()) {
            return ResponseEntity.badRequest().body("submissionId가 필요합니다.");
        }
        long submissionId;
        try {
            submissionId = Long.parseLong(submissionIdStr.trim());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("유효한 submissionId가 아닙니다.");
        }
        try {
            String answer = aiSubmissionService.chatWithSubmission(submissionId, message);
            return ResponseEntity.ok(answer);
        } catch (Exception e) {
            log.error("/api/ai/chat/with-submission 실패. submissionId={}", submissionId, e);
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            return ResponseEntity.ok("오류가 발생했어요. " + msg);
        }
    }

    @PostMapping("/note/classify")
    public ResponseEntity<String> classifyNote(@RequestBody Map<String, String> request) {
        String question = request.get("question");
        String answer = request.get("answer");

        String prompt =
                "다음 내용을 'SUMMARY' 또는 'PROBLEM' 중 하나로만 분류해.\n" +
                "- SUMMARY: 요약/정리/개념정리/설명 중심\n" +
                "- PROBLEM: 문제/퀴즈/오답노트용 질문 중심\n\n" +
                "질문:\n" + (question == null ? "" : question) + "\n\n" +
                "AI답변:\n" + (answer == null ? "" : answer) + "\n\n" +
                "반드시 SUMMARY 또는 PROBLEM 중 하나만 출력해.";

        String raw = openAiService.getContents(prompt);
        String normalized = raw == null ? "" : raw.trim().toUpperCase();
        if (normalized.contains("SUMMARY")) return ResponseEntity.ok("SUMMARY");
        if (normalized.contains("PROBLEM")) return ResponseEntity.ok("PROBLEM");
        // 애매하면 기본값
        return ResponseEntity.ok("PROBLEM");
    }
}
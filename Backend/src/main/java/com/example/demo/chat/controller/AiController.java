package com.example.demo.chat.controller;

import com.example.demo.ai.AiSubmissionService;
import com.example.demo.chat.service.OpenAiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final OpenAiService openAiService;
    private final AiSubmissionService aiSubmissionService;

    /** 일반 채팅. 직전까지의 전체 대화(history)를 넘기면 LLM이 모든 맥락을 기억한 채 답변함. */
    @PostMapping("/chat")
    @SuppressWarnings("unchecked")
    public ResponseEntity<String> chat(@RequestBody Map<String, Object> request) {
        String userMessage = request.get("message") != null ? String.valueOf(request.get("message")) : null;
        List<Map<String, String>> history = new ArrayList<>();
        if (request.get("history") instanceof List) {
            for (Object item : (List<?>) request.get("history")) {
                if (item instanceof Map) {
                    Map<?, ?> m = (Map<?, ?>) item;
                    String role = m.get("role") != null ? String.valueOf(m.get("role")) : null;
                    String content = m.get("content") != null ? String.valueOf(m.get("content")) : null;
                    if (role != null && !role.isBlank() && content != null) {
                        history.add(Map.of("role", role, "content", content));
                    }
                }
            }
        }
        String answer = openAiService.getContentsWithFullHistory(userMessage != null ? userMessage : "", history);
        return ResponseEntity.ok(answer);
    }

    /**
     * 제출물(submissionId)을 자동으로 다운로드해 AI가 읽고 답변 (이미지 → Vision, PDF → 텍스트 추출 후 채팅)
     * Body: { "message": "이 과제 피드백해줘", "submissionId": "123" }
     */
    @PostMapping("/chat/with-submission")
    public ResponseEntity<String> chatWithSubmission(@RequestBody Map<String, String> request) {
        String message = request.get("message");
        if (message != null && !message.isBlank()) {
            message = "사용자 질문: " + message;
        }

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
            // "1. 분류: SUMMARY/PROBLEM" 줄과 "2. 답변:" / "2 답변:" 문구 제거
            if (answer != null) {
                answer = answer.replaceFirst("(?m)^\\s*1\\.\\s*분류\\s*:\\s*(SUMMARY|PROBLEM)\\s*\\n?", "");
                answer = answer.replaceFirst("(?m)^\\s*2\\.?\\s*답변\\s*:\\s*\\n?", "");
                answer = answer.trim();
            }
            return ResponseEntity.ok(answer != null ? answer : "");
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
                "반드시 SUMMARY 또는 PROBLEM 중 하나만 출력해." + "\n\n" +
                "반드시 한국어로 대답하고 존댓말로 대답해." + "\n\n" +
                "한국어로 대답해드릴게요. 라는 말은 하지마";

        String raw = openAiService.getContents(prompt);

        String normalized = raw == null ? "" : raw.trim().toUpperCase();
        if (normalized.contains("SUMMARY")) return ResponseEntity.ok("SUMMARY");
        if (normalized.contains("PROBLEM")) return ResponseEntity.ok("PROBLEM");
        // 애매하면 기본값
        return ResponseEntity.ok("PROBLEM");
    }
}
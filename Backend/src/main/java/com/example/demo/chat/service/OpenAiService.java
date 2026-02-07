package com.example.demo.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenAiService {

    private final RestTemplate restTemplate;

    @Value("${openai.api.key}")
    private String apiKey;

    @Value("${openai.model}")
    private String model;

    @Value("${openai.api.url}")
    private String apiUrl;

    @Value("${openai.vision.model:${openai.model:gpt-4o}}")
    private String visionModel;

    /** 대화 기록에 넣을 최대 메시지 수 (토큰 제한 방지, 최근 N개만 사용) */
    private static final int MAX_HISTORY_MESSAGES = 30;

    public String getContents(String prompt) {
        return getContentsWithFullHistory(prompt, null);
    }

    /**
     * 직전까지의 전체 대화(history)를 LLM에 전달. 모든 맥락을 기억한 답변이 가능해짐.
     * history: [ { "role": "user"|"assistant", "content": "..." }, ... ] 순서대로.
     */
    public String getContentsWithFullHistory(String currentUserMessage, List<Map<String, String>> history) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);

            List<Map<String, String>> messages = new ArrayList<>();

            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "너는 친절하고 명확하게 설명해주는 자격증 관련 학습 튜터야. 한국어로 답변해줘. 이전 대화 맥락이 주어지면 그에 맞춰 이어서 답변해줘.");
            messages.add(systemMessage);

            // 직전까지의 전체 대화 추가 (최근 MAX_HISTORY_MESSAGES개만 사용해 토큰 제한 방지)
            if (history != null && !history.isEmpty()) {
                int from = Math.max(0, history.size() - MAX_HISTORY_MESSAGES);
                for (int i = from; i < history.size(); i++) {
                    Map<String, String> turn = history.get(i);
                    String role = turn.get("role");
                    String content = turn.get("content");
                    if (role != null && content != null && !content.isBlank()) {
                        if ("user".equalsIgnoreCase(role) || "assistant".equalsIgnoreCase(role)) {
                            messages.add(Map.of("role", role.toLowerCase(), "content", content));
                        }
                    }
                }
            }

            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", currentUserMessage != null ? currentUserMessage : "");
            messages.add(userMessage);

            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.7);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(apiUrl, entity, Map.class);

            if (response.getBody() != null && response.getBody().containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.getBody().get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> messageObj = (Map<String, Object>) choices.get(0).get("message");
                    return (String) messageObj.get("content");
                }
            }
            return "AI 응답을 불러올 수 없습니다.";
        } catch (Exception e) {
            log.error("OpenAI API 호출 중 에러 발생: {}", e.getMessage());
            return "죄송해요, AI 서버와 연결 중 오류가 발생했어요. 😭 (" + e.getMessage() + ")";
        }
    }

    /**
     * 이미지 + 사용자 메시지를 Vision API로 전달 (과제 제출물 등)
     */
    public String getContentsWithImage(byte[] imageBytes, String imageMediaType, String userMessage) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String dataUrl = "data:" + (imageMediaType != null ? imageMediaType : "image/jpeg") + ";base64," + base64Image;

            List<Map<String, Object>> messages = new ArrayList<>();

            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "너는 친절하고 명확하게 설명해주는 자격증 관련 학습 튜터야. 사용자가 보낸 이미지는 과제 제출물이나 자료야. 내용을 보고 질문에 한국어로 답변해줘.");
            messages.add(new HashMap<>(systemMessage));

            List<Map<String, Object>> userContent = new ArrayList<>();
            userContent.add(Map.of("type", "text", "text", userMessage != null && !userMessage.isBlank() ? userMessage : "이 자료를 보고 요약하거나 피드백해줘."));
            userContent.add(Map.of(
                    "type", "image_url",
                    "image_url", Map.of("url", dataUrl)
            ));
            Map<String, Object> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", userContent);
            messages.add(userMsg);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", visionModel);
            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.7);
            requestBody.put("max_tokens", 1024);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(apiUrl, entity, Map.class);

            if (response.getBody() != null && response.getBody().containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.getBody().get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> messageObj = (Map<String, Object>) choices.get(0).get("message");
                    return (String) messageObj.get("content");
                }
            }
            return "AI 응답을 불러올 수 없습니다.";
        } catch (Exception e) {
            log.error("OpenAI Vision API 호출 중 에러: {}", e.getMessage());
            return "죄송해요, 이미지 분석 중 오류가 발생했어요. 😭 (" + e.getMessage() + ")";
        }
    }
}
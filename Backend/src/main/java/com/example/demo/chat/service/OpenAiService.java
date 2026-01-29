package com.example.demo.chat.service; // 👈 패키지명 확인!

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

    public String getContents(String prompt) {
        try {
            // 1. 헤더 설정 (Authorization: Bearer 키)
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            // 2. 요청 바디 구성 (Message 구조)
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);

            // 대화 메시지 구성 (System 역할 + User 역할)
            List<Map<String, String>> messages = new ArrayList<>();

            // (선택) AI에게 페르소나 부여
            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "너는 친절하고 명확하게 설명해주는 자격증 관련 학습 튜터야. 한국어로 답변해줘.");
            messages.add(systemMessage);

            // 사용자 질문
            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", prompt);
            messages.add(userMessage);

            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.7); // 창의성 조절 (0.0 ~ 1.0)

            // 3. API 호출
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(apiUrl, entity, Map.class);

            // 4. 응답 파싱 (GPT의 응답 구조: choices[0].message.content)
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
}
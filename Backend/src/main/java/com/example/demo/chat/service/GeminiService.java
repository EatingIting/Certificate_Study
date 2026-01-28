package com.example.demo.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiService {

    @Value("${gemini.api.url}")
    private String apiUrl;

    @Value("${gemini.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public String getContents(String prompt, String subject) {
        try {
            // 1. 요청 URL 완성
            String requestUrl = apiUrl + apiKey;

            // 2. 헤더 및 요청 바디 생성 (Gemini가 원하는 JSON 모양으로 만듦)
            Map<String, Object> requestBody = new HashMap<>();
            List<Map<String, Object>> contents = new ArrayList<>();
            Map<String, Object> content = new HashMap<>();
            List<Map<String, Object>> parts = new ArrayList<>();
            Map<String, Object> part = new HashMap<>();

            String systemPrompt = String.format(" (이 질문에 대해 '%s' 전문가 튜터로서 친절하고 명확하게 답변해줘. 초보자도 이해하기 쉽게 설명해줘)", subject);
            part.put("text", prompt + systemPrompt);
            parts.add(part);
            content.put("parts", parts);
            contents.add(content);
            requestBody.put("contents", contents);

            // 3. API 호출 (POST)
            Map<String, Object> response = restTemplate.postForObject(requestUrl, requestBody, Map.class);

            // 4. 응답 파싱 (JSON 깊숙한 곳에 있는 답변 꺼내기)
            // 구조: candidates[0] -> content -> parts[0] -> text
            if (response != null && response.containsKey("candidates")) {
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
                if (!candidates.isEmpty()) {
                    Map<String, Object> candidate = candidates.get(0);
                    Map<String, Object> resContent = (Map<String, Object>) candidate.get("content");
                    List<Map<String, Object>> resParts = (List<Map<String, Object>>) resContent.get("parts");
                    return (String) resParts.get(0).get("text");
                }
            }
            return "Gemini가 답변을 거부했습니다.";

        } catch (Exception e) {
            log.error("Gemini API 호출 중 에러 발생", e);
            return "죄송해요, AI 서버 연결에 문제가 생겼어요. 😭";
        }
    }
}
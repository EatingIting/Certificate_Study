package com.example.demo.service;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class SfuClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String SFU_BASE_URL = "http://localhost:4000";

    public <T> T post(String path, Object body, Class<T> responseType) {
        return restTemplate.postForObject(
                SFU_BASE_URL + path,
                body,
                responseType
        );
    }
}
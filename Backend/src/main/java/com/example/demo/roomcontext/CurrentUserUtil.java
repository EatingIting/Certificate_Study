package com.example.demo.roomcontext;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserUtil {

    public String getCurrentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().trim().isEmpty()) {
            throw new RuntimeException("인증 정보가 없습니다.");
        }
        return auth.getName(); // 보통 email
    }
}
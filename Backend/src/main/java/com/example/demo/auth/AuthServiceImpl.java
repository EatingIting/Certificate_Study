package com.example.demo.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AuthMapper authMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public boolean isEmailAvailable(String email) {
        return authMapper.countByEmail(email) == 0;
    }

    @Override
    public void signup(AuthVO authVO) {

        if (authMapper.countByEmail(authVO.getEmail()) > 0) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        authVO.setUserId(UUID.randomUUID().toString());
        authVO.setPassword(passwordEncoder.encode(authVO.getPassword()));

        authMapper.insertUser(authVO);
    }

    @Override
    public String login(String email, String password) {

        AuthVO user = authMapper.findByEmail(email);

        if (user == null ||
                !passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // ✅ 지금은 JWT 안 쓰고 로그인 성공만 반환
        return "LOGIN_SUCCESS";
    }
}

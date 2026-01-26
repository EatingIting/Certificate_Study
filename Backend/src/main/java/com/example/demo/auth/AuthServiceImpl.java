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
    public AuthVO login(String email, String password) {

        AuthVO user = authMapper.findByEmail(email);

        if (user == null ||
                !passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 로그인 성공 → 사용자 정보 반환
        return user;
    }

    @Override
    public void signupOAuthUser(String email, String nickname) {

        AuthVO existingUser = authMapper.findByEmail(email);

        // 이미 가입된 경우
        if (existingUser != null) {

            // 일반 회원이면 → 카카오 로그인 차단
            if (!existingUser.getPassword().equals("OAUTH_LOGIN")) {
                throw new IllegalStateException(
                        "이미 일반 회원가입으로 가입된 이메일입니다."
                );
            }

            // OAuth 회원이면 그냥 로그인 허용
            return;
        }

        // 회원 없으면 자동 가입
        AuthVO user = new AuthVO();
        user.setUserId(UUID.randomUUID().toString());
        user.setEmail(email);

        // OAuth는 고정값 저장
        user.setPassword("OAUTH_LOGIN");

        user.setNickname(nickname);
        user.setName(nickname);
        user.setIntroduction("카카오 로그인 회원");

        authMapper.insertUser(user);

        System.out.println("OAuth 자동 회원가입 완료");
    }

    @Override
    public AuthVO findByEmail(String email) {
        return authMapper.findByEmail(email);
    }

}

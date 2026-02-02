package com.example.demo.로그인.service;

import com.example.demo.로그인.vo.AuthVO;

public interface AuthService {

    boolean isEmailAvailable(String email);

    void signup(AuthVO authVO);

    AuthVO login(String email, String password);

    void signupOAuthUser(String email, String nickname);

    AuthVO findByEmail(String email);
}

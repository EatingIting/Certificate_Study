package com.example.demo.auth;

public interface AuthService {

    boolean isEmailAvailable(String email);

    void signup(AuthVO authVO);

    AuthVO login(String email, String password);
}

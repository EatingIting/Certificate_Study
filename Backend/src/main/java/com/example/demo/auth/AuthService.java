package com.example.demo.auth;

public interface AuthService {

    boolean isEmailAvailable(String email);

    void signup(AuthVO authVO);

    String login(String email, String password);
}

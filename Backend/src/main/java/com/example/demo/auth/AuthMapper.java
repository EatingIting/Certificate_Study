package com.example.demo.auth;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuthMapper {

    int countByEmail(String email);

    void insertUser(AuthVO authVO);

    AuthVO findByEmail(String email);
}
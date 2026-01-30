package com.example.demo.로그인.mapper;

import com.example.demo.로그인.vo.AuthVO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuthMapper {

    int countByEmail(String email);

    void insertUser(AuthVO authVO);

    AuthVO findByEmail(String email);

}
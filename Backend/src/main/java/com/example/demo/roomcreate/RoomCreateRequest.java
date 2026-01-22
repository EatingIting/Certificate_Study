package com.example.demo.roomcreate;

import lombok.Data;

@Data
public class RoomCreateRequest {
    private String title;
    private String description;   // 프론트는 description
    private String gender;        // 프론트는 gender (ALL/FEMALE/MALE)
    private int maxPeople;        // 프론트는 maxPeople
    private Long categoryId;      // ⭐ 프론트와 동일
}
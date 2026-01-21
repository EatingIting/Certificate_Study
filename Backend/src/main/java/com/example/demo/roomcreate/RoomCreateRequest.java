package com.example.demo.roomcreate;

import lombok.Data;

@Data
public class RoomCreateRequest {
    private String title;
    private String description;
    private String gender;
    private int maxPeople;
    private Long categoryId;
}
package com.example.demo.dto;

import lombok.Getter;

@Getter
public class ProduceRequest {

    private String roomId;
    private String transportId;
    private String kind;
    private Object rtpParameters;
}
package com.example.demo.dto;

import lombok.Getter;

@Getter
public class ConsumeRequest {

    private String roomId;
    private String transportId;
    private String producerId;
    private Object rtpCapabilities;
}
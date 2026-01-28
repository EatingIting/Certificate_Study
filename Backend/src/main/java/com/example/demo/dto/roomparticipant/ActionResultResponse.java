package com.example.demo.dto.roomparticipant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ActionResultResponse {
    private boolean success;
    private String message;
}

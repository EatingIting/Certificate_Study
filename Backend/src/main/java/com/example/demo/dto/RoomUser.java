package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class RoomUser {
    private String userId;
    private String userName;
    private long joinAt;
    private boolean speaking;
    private boolean muted;
    private boolean cameraOff;
    private boolean explicitlyLeft = false;
}
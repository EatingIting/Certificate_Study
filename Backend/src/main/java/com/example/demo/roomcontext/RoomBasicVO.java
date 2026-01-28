package com.example.demo.roomcontext;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomBasicVO {
    private String roomId;
    private String title;
    private String hostUserEmail; // room.host_user_email
}
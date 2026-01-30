package com.example.demo.모집.service;

import com.example.demo.모집.vo.RoomJoinRequestVO;

import java.util.List;

public interface RoomJoinRequestService {

    void apply(RoomJoinRequestVO vo);

    List<RoomJoinRequestVO> getSent(String userEmail);

    List<RoomJoinRequestVO> getReceived(String userEmail);

    void updateStatus(RoomJoinRequestVO vo);
}

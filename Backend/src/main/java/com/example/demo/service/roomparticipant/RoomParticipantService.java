package com.example.demo.service.roomparticipant;

import com.example.demo.dto.roomparticipant.ActionResultResponse;
import com.example.demo.dto.roomparticipant.KickMemberRequest;
import com.example.demo.dto.roomparticipant.RoomParticipantListResponse;
import com.example.demo.dto.roomparticipant.TransferOwnerRequest;

public interface RoomParticipantService {

    RoomParticipantListResponse getParticipants(String roomId, String myEmail);

    ActionResultResponse kickParticipant(String roomId, String myEmail, KickMemberRequest request);

    ActionResultResponse transferOwner(String roomId, String myEmail, TransferOwnerRequest request);

    ActionResultResponse leaveRoom(String roomId, String myEmail);
}
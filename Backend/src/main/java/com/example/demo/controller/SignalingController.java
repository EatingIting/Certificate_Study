package com.example.demo.controller;

import com.example.demo.dto.ConsumeRequest;
import com.example.demo.dto.ProduceRequest;
import com.example.demo.dto.RoomRequest;
import com.example.demo.dto.TransportRequest;
import com.example.demo.service.SfuClient;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/signal")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SignalingController {

    private final SfuClient sfuClient;

    @PostMapping("/room")
    public Object createRoom(@RequestBody RoomRequest request) {
        return sfuClient.post("/rooms", request, Object.class);
    }

    @PostMapping("/transport")
    public Object createTransport(@RequestBody TransportRequest request) {
        return sfuClient.post("/transports", request, Object.class);
    }

    @PostMapping("/produce")
    public Object produce(@RequestBody ProduceRequest request) {
        return sfuClient.post("/produce", request, Object.class);
    }

    @PostMapping("/consume")
    public Object consume(@RequestBody ConsumeRequest request) {
        return sfuClient.post("/consume", request, Object.class);
    }
}
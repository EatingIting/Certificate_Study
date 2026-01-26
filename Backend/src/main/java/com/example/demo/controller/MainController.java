package com.example.demo.controller;

import com.example.demo.main.MainService;
import com.example.demo.main.MainVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/main")
public class MainController {

    private final MainService mainService;

    @GetMapping("/rooms")
    public List<MainVO> mainRooms() {
        return mainService.getMainRooms();
    }
}
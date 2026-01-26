package com.example.demo.main;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MainServiceImpl implements MainService {

    private final MainMapper mainMapper;

    @Override
    public List<MainVO> getMainRooms() {
        return mainMapper.selectMainRooms();
    }
}

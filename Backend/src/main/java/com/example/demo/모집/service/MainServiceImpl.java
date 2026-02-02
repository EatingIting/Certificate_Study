package com.example.demo.모집.service;

import com.example.demo.모집.mapper.MainMapper;
import com.example.demo.모집.vo.MainVO;
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

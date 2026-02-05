package com.example.demo.board.scheduler;

import com.example.demo.board.mapper.BoardPostMapper;
import com.example.demo.board.service.BoardPostService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BoardPostPurgeScheduler {

    private final BoardPostMapper boardPostMapper;
    private final BoardPostService boardPostService;

    // 운영 정책: soft delete 후 30일 지난 게시글 물리 삭제
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void purgeSoftDeletedPosts() {
        try {
            int deleted = boardPostService.purgeDeletedPosts(30);
            log.info("[BoardPurge] deletedPosts={}", deleted);
        } catch (Exception e) {
            // 배치는 죽지 말고 로그만 남기는게 보통 안전함
            log.error("[BoardPurge] failed", e);
        }
    }
}
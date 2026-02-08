package com.example.demo.화상채팅.Service;

import com.example.demo.schedule.service.StudyScheduleService;
import com.example.demo.schedule.vo.StudyScheduleVO;
import com.example.demo.화상채팅.Domain.MeetingRoomParticipant;
import com.example.demo.화상채팅.Repository.MeetingRoomKickedUserRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomParticipantRepository;
import com.example.demo.화상채팅.Repository.MeetingRoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.sql.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeetingRoomServiceImplTests {

    private MeetingRoomRepository meetingRoomRepository;
    private MeetingRoomParticipantRepository participantRepository;
    private MeetingRoomKickedUserRepository kickedUserRepository;
    private StudyScheduleService studyScheduleService;

    private MeetingRoomServiceImpl service;

    @BeforeEach
    void setUp() {
        meetingRoomRepository = mock(MeetingRoomRepository.class);
        participantRepository = mock(MeetingRoomParticipantRepository.class);
        kickedUserRepository = mock(MeetingRoomKickedUserRepository.class);
        studyScheduleService = mock(StudyScheduleService.class);

        service = new MeetingRoomServiceImpl(
                meetingRoomRepository,
                participantRepository,
                kickedUserRepository,
                studyScheduleService
        );
    }

    @Test
    void handleJoin_usesProvidedScheduleIdWhenItMatchesSubject() {
        String subjectId = "subject-1";
        String roomId = "ROOM1234";
        String email = "user@example.com";

        when(studyScheduleService.getBySubjectIdAndScheduleId(subjectId, 3L))
                .thenReturn(StudyScheduleVO.builder()
                        .subjectId(subjectId)
                        .studyScheduleId(3L)
                        .roundNum(3)
                        .studyDate(Date.valueOf("2026-02-07"))
                        .build());
        when(participantRepository.findByScheduleIdAndRoomIdAndUserEmail(3L, roomId, email))
                .thenReturn(Optional.empty());

        service.handleJoin(roomId, email, "title", false, subjectId, 3L);

        verify(studyScheduleService, never()).findActiveScheduleIdByCurrentTime(anyString());
        verify(studyScheduleService, never()).getOrCreateTodayScheduleId(anyString());

        ArgumentCaptor<MeetingRoomParticipant> captor = ArgumentCaptor.forClass(MeetingRoomParticipant.class);
        verify(participantRepository).save(captor.capture());
        assertThat(captor.getValue().getScheduleId()).isEqualTo(3L);
        assertThat(captor.getValue().getSubjectId()).isEqualTo(subjectId);
    }

    @Test
    void handleJoin_fallsBackToActiveScheduleWhenProvidedScheduleIsInvalid() {
        String subjectId = "subject-1";
        String roomId = "ROOM1234";
        String email = "user@example.com";

        when(studyScheduleService.getBySubjectIdAndScheduleId(subjectId, 999L)).thenReturn(null);
        when(studyScheduleService.findActiveScheduleIdByCurrentTime(subjectId)).thenReturn(5L);
        when(participantRepository.findByScheduleIdAndRoomIdAndUserEmail(5L, roomId, email))
                .thenReturn(Optional.empty());

        service.handleJoin(roomId, email, "title", false, subjectId, 999L);

        verify(studyScheduleService).findActiveScheduleIdByCurrentTime(subjectId);

        ArgumentCaptor<MeetingRoomParticipant> captor = ArgumentCaptor.forClass(MeetingRoomParticipant.class);
        verify(participantRepository).save(captor.capture());
        assertThat(captor.getValue().getScheduleId()).isEqualTo(5L);
        assertThat(captor.getValue().getSubjectId()).isEqualTo(subjectId);
    }

    @Test
    void handleJoin_whenScheduleIsMissing_resolvesTodayScheduleBeforeInsert() {
        String subjectId = "subject-1";
        String roomId = "ROOM1234";
        String email = "user@example.com";

        when(studyScheduleService.findActiveScheduleIdByCurrentTime(subjectId)).thenReturn(null);
        when(studyScheduleService.getOrCreateTodayScheduleId(subjectId)).thenReturn(2L);
        when(participantRepository.findByScheduleIdAndRoomIdAndUserEmail(2L, roomId, email))
                .thenReturn(Optional.empty());

        service.handleJoin(roomId, email, "title", false, subjectId, null);

        verify(studyScheduleService).getOrCreateTodayScheduleId(subjectId);
        ArgumentCaptor<MeetingRoomParticipant> captor = ArgumentCaptor.forClass(MeetingRoomParticipant.class);
        verify(participantRepository).save(captor.capture());
        assertThat(captor.getValue().getScheduleId()).isEqualTo(2L);
    }
}

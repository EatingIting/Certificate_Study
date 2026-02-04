package com.example.demo.answernote.service;

import com.example.demo.answernote.dto.AnswerNoteRequestDTO;
import com.example.demo.answernote.dto.AnswerNoteResponseDTO;
import com.example.demo.answernote.entity.AnswerNote;
import com.example.demo.answernote.entity.AnswerNoteType;
import com.example.demo.answernote.repository.AnswerNoteRepository;

import com.example.demo.LMS회원.Repository.RoomRepository;
import com.example.demo.LMS회원.Repository.UserRepository;
import com.example.demo.roomparticipant.RoomParticipantMapper;
import com.example.demo.roomparticipant.RoomParticipantVO;

import com.example.demo.entity.Room;
import com.example.demo.entity.User;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AnswerNoteService {

    private final AnswerNoteRepository answerNoteRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomParticipantMapper roomParticipantMapper;

    // 1. 저장 (이메일 조회 방식 유지)
    public void saveNote(String userEmail, AnswerNoteRequestDTO dto) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다. (Email: " + userEmail + ")"));

        Room room = roomRepository.findById(dto.getSubjectId())
                .orElseThrow(() -> new IllegalArgumentException("방을 찾을 수 없습니다."));

        AnswerNoteType noteType = AnswerNoteType.PROBLEM;
        if (dto.getType() != null && !dto.getType().isBlank()) {
            try {
                noteType = AnswerNoteType.valueOf(dto.getType().trim().toUpperCase());
            } catch (Exception ignored) {
                noteType = AnswerNoteType.PROBLEM;
            }
        }

        AnswerNote note = AnswerNote.builder()
                .answerNoteId(UUID.randomUUID().toString())
                .user(user)
                .room(room)
                .question(dto.getQuestion())
                .answer(dto.getAnswer())
                .memo(dto.getMemo())
                .noteType(noteType)
                .build();

        answerNoteRepository.save(note);
    }

    /** 노트 수정 (본인 노트만) */
    public void updateNote(String noteId, String userEmail, AnswerNoteRequestDTO dto) {
        AnswerNote note = answerNoteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("노트를 찾을 수 없습니다."));
        if (note.getUser() == null || !userEmail.equals(note.getUser().getEmail())) {
            throw new IllegalArgumentException("본인의 노트만 수정할 수 있습니다.");
        }
        AnswerNoteType noteType = note.getNoteType();
        if (dto.getType() != null && !dto.getType().isBlank()) {
            try {
                noteType = AnswerNoteType.valueOf(dto.getType().trim().toUpperCase());
            } catch (Exception ignored) { }
        }
        note.updateContent(
                dto.getQuestion() != null ? dto.getQuestion() : note.getQuestion(),
                dto.getAnswer() != null ? dto.getAnswer() : note.getAnswer(),
                dto.getMemo(),
                noteType
        );
        answerNoteRepository.save(note);
    }

    /** 노트 삭제 (본인 노트만) */
    public void deleteNote(String noteId, String userEmail) {
        AnswerNote note = answerNoteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("노트를 찾을 수 없습니다."));
        if (note.getUser() == null || !userEmail.equals(note.getUser().getEmail())) {
            throw new IllegalArgumentException("본인의 노트만 삭제할 수 있습니다.");
        }
        answerNoteRepository.delete(note);
    }

    // 2. 조회
    @Transactional(readOnly = true)
    public List<AnswerNoteResponseDTO> getNotesByRoom(String roomId) {
        List<AnswerNote> notes = answerNoteRepository.findByRoom_RoomIdOrderByCreatedAtDesc(roomId);

        // 방 참가자 정보(방별 닉네임 포함)를 한 번에 조회해서 email -> nickname 매핑
        List<RoomParticipantVO> approved = roomParticipantMapper.selectApprovedParticipants(roomId);
        RoomParticipantVO hostVo = roomParticipantMapper.selectHostParticipant(roomId);

        java.util.Map<String, String> nickByEmail = new java.util.HashMap<>();
        if (hostVo != null && hostVo.getEmail() != null) {
            nickByEmail.put(hostVo.getEmail(), hostVo.getNickname());
        }
        for (RoomParticipantVO v : approved) {
            if (v.getEmail() != null && v.getNickname() != null) {
                // 같은 이메일이면 host(방장) 정보가 우선이므로 putIfAbsent
                nickByEmail.putIfAbsent(v.getEmail(), v.getNickname());
            }
        }

        // 원본(Entity) 리스트를 -> 포장된(DTO) 리스트로 변환
        return notes.stream()
                .map(note -> toDtoWithAuthorName(note, nickByEmail))
                .collect(Collectors.toList());
    }

    /**
     * 노트 작성자 표시용 이름 계산
     * 1) 방별(LMS) 닉네임: RoomParticipantMapper 에서 내려주는 nickname
     *    - 호스트이면서 member 인 경우에도 이 값을 우선 사용
     * 2) room.hostUserNickname (방 정보에만 닉네임이 있을 때)
     * 3) 위가 없으면 최종 fallback 으로 전역 유저 닉네임/이름/이메일
     */
    private AnswerNoteResponseDTO toDtoWithAuthorName(AnswerNote note, java.util.Map<String, String> nickByEmail) {
        String authorName = null;

        User user = note.getUser();
        Room room = note.getRoom();
        String email = (user != null ? user.getEmail() : null);
        String roomId = (room != null ? room.getRoomId() : null);

        // 1) 방별(LMS) 닉네임: RoomParticipantMapper 에서 내려주는 nickname
        //    (호스트이면서 member 인 경우에도 이 값을 우선 사용)
        if (email != null && nickByEmail != null) {
            String nick = nickByEmail.get(email);
            if (nick != null && !nick.isBlank()) {
                authorName = nick;
            }
        }

        // 2) room.hostUserNickname (호스트인데 room_join_request 가 없을 때)
        if (authorName == null && room != null && email != null && email.equals(room.getHostUserEmail())) {
            String hostNick = room.getHostUserNickname();
            if (hostNick != null && !hostNick.isBlank()) {
                authorName = hostNick;
            }
        }

        // 3) 최종 fallback: 전역 유저 정보
        if (authorName == null && user != null) {
            String nickname = user.getNickname();
            String name = user.getName();
            String emailFallback = user.getEmail();
            if (nickname != null && !nickname.isBlank()) {
                authorName = nickname;
            } else if (name != null && !name.isBlank()) {
                authorName = name;
            } else {
                authorName = emailFallback;
            }
        }

        return new AnswerNoteResponseDTO(note, authorName);
    }
}
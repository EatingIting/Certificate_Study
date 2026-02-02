package com.example.demo.roomparticipant;

import com.example.demo.dto.roomparticipant.*;
import com.example.demo.로그인.mapper.AuthMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomParticipantServiceImpl implements RoomParticipantService {

    private final RoomParticipantMapper mapper;
    private final AuthMapper authMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public RoomParticipantListResponse getParticipants(String roomId, String myEmail) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 스터디룸입니다.");
        }

        // ✅ 스터디 소속(방장 또는 승인 멤버)만 접근 가능
        boolean isHost = hostEmail.equals(myEmail);
        int approvedCount = mapper.countApprovedByEmail(roomId, myEmail);
        if (!isHost && approvedCount == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "스터디원만 접근할 수 있습니다.");
        }

        List<RoomParticipantVO> approved = mapper.selectApprovedParticipants(roomId);

        // host가 승인 목록에 없을 수도 있으니, 보장용으로 host 정보도 가져와서 합침
        RoomParticipantVO hostVo = mapper.selectUserByEmail(hostEmail);
        if (hostVo != null) {
            boolean alreadyIncluded = approved.stream()
                    .anyMatch(v -> hostEmail.equals(v.getEmail()));
            if (!alreadyIncluded) {
                approved = new ArrayList<>(approved);
                approved.add(hostVo);
            }
        }

        List<RoomParticipantItemResponse> items = approved.stream()
                .map(v -> {
                    RoomParticipantItemResponse r = new RoomParticipantItemResponse();
                    r.setId(v.getUserId());
                    r.setEmail(v.getEmail());
                    r.setName((v.getName() != null && !v.getName().isBlank()) ? v.getName() : v.getNickname());
                    r.setProfileImg(v.getProfileImg());
                    r.setJoinedAt(v.getJoinedAt());
                    r.setRole(hostEmail.equals(v.getEmail()) ? "OWNER" : "MEMBER");
                    return r;
                })
                // joinedAt 최신순(없으면 뒤로)
                .sorted(Comparator.comparing(
                        RoomParticipantItemResponse::getJoinedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        String myRole = isHost ? "OWNER" : "MEMBER";
        return new RoomParticipantListResponse(
                roomId,
                myRole,
                items.size(),
                items);
    }

    @Override
    public ActionResultResponse kickParticipant(String roomId, String myEmail, KickMemberRequest request) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 스터디룸입니다.");
        }

        if (!hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "방장만 강퇴할 수 있습니다.");
        }

        if (request == null || request.getTargetUserId() == null || request.getTargetUserId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetUserId가 필요합니다.");
        }

        String targetEmail = mapper.selectEmailByUserId(request.getTargetUserId());
        if (targetEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "대상 유저를 찾을 수 없습니다.");
        }

        // 방장은 강퇴 불가
        if (hostEmail.equals(targetEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "방장은 내보낼 수 없습니다.");
        }

        int deleted = mapper.deleteApprovedByEmail(roomId, targetEmail);

        if (deleted == 0) {
            // 이미 나갔거나 승인 멤버가 아닐 수 있음
            return new ActionResultResponse(false, "승인된 멤버가 아니거나 이미 처리되었습니다.");
        }

        return new ActionResultResponse(true, "스터디원을 내보냈어요.");
    }

    @Override
    public ActionResultResponse transferOwner(String roomId, String myEmail, TransferOwnerRequest request) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 스터디룸입니다.");
        }

        if (!hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "방장만 위임할 수 있습니다.");
        }

        if (request == null || request.getTargetUserId() == null || request.getTargetUserId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetUserId가 필요합니다.");
        }

        String targetEmail = mapper.selectEmailByUserId(request.getTargetUserId());
        if (targetEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "대상 유저를 찾을 수 없습니다.");
        }

        if (hostEmail.equals(targetEmail)) {
            return new ActionResultResponse(false, "이미 방장입니다.");
        }

        // 대상이 승인 멤버인지 확인(또는 host였으면 위에서 이미 걸림)
        int isApproved = mapper.countApprovedByEmail(roomId, targetEmail);
        if (isApproved == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "승인된 멤버에게만 방장을 위임할 수 있습니다.");
        }

        int updated = mapper.updateHostEmail(roomId, targetEmail);
        if (updated == 0) {
            return new ActionResultResponse(false, "방장 위임에 실패했습니다.");
        }

        return new ActionResultResponse(true, "방장 권한을 위임했어요.");
    }

    @Override
    public ActionResultResponse verifyLeavePassword(String roomId, String myEmail, VerifyLeaveRoomPasswordRequest request) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 스터디룸입니다.");
        }

        // 방장은 탈퇴 불가 → 굳이 비번 검증할 필요도 없으니 여기서 차단
        if (hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "방장은 탈퇴할 수 없습니다. 방장 위임 후 탈퇴하세요.");
        }

        // 승인 멤버가 아니면 검증/탈퇴 둘 다 불가하게(지금 leaveRoom이랑 정책 통일)
        int isApproved = mapper.countApprovedByEmail(roomId, myEmail);
        if (isApproved == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "승인된 멤버만 탈퇴할 수 있습니다.");
        }

        if (request == null || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해 주세요.");
        }

        // users 조회(기존 로그인쪽 mapper 재사용)
        com.example.demo.로그인.vo.AuthVO user = authMapper.findByEmail(myEmail);
        if (user == null || user.getPassword() == null || user.getPassword().isBlank()) {
            // 계정 존재 여부를 노출하지 않도록 메시지 단순화
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호가 일치하지 않습니다.");
        }

        boolean ok = passwordEncoder.matches(request.getPassword(), user.getPassword());
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호가 일치하지 않습니다.");
        }

        return new ActionResultResponse(true, "비밀번호 확인 완료");
    }

    @Override
    public ActionResultResponse leaveRoom(String roomId, String myEmail) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 스터디룸입니다.");
        }

        // 방장은 탈퇴 불가(위임 후 나가야 함)
        if (hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "방장은 탈퇴할 수 없습니다. 방장 위임 후 탈퇴하세요.");
        }

        int deleted = mapper.deleteApprovedByEmail(roomId, myEmail);
        if (deleted == 0) {
            return new ActionResultResponse(false, "승인된 멤버가 아니거나 이미 탈퇴되었습니다.");
        }

        return new ActionResultResponse(true, "스터디룸에서 탈퇴했어요.");
    }
}
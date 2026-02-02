package com.example.demo.roomparticipant;

import com.example.demo.dto.roomparticipant.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomParticipantServiceImpl implements RoomParticipantService {

    private final RoomParticipantMapper mapper;

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

        // 같은 room_id: (1) host_user_email(스터디장) + (2) status='승인'인 request_user_email 전원
        List<RoomParticipantVO> approved = mapper.selectApprovedParticipants(roomId);

        // 스터디장(host_user_email): room에는 있으나 room_join_request 승인 행에 없을 수 있으므로 별도 조회 후 맨 앞에 추가
        RoomParticipantVO hostVo = mapper.selectUserByEmail(hostEmail);
        List<RoomParticipantVO> allParticipants = new ArrayList<>();
        if (hostVo != null) {
            allParticipants.add(hostVo);
        }
        for (RoomParticipantVO v : approved) {
            if (v.getEmail() == null || !v.getEmail().equals(hostEmail)) {
                allParticipants.add(v);
            }
        }

        // 스터디장(OWNER) 먼저, 그 다음 승인 멤버를 joinedAt 최신순으로
        List<RoomParticipantItemResponse> items = allParticipants.stream()
                .map(v -> {
                    RoomParticipantItemResponse r = new RoomParticipantItemResponse();
                    r.setId(v.getUserId());
                    r.setEmail(v.getEmail());
                    r.setName(v.getName());
                    r.setNickname(v.getNickname());
                    r.setProfileImg(v.getProfileImg());
                    r.setJoinedAt(v.getJoinedAt());
                    r.setRole(hostEmail.equals(v.getEmail()) ? "OWNER" : "MEMBER");
                    return r;
                })
                .sorted(Comparator
                        .comparing(RoomParticipantItemResponse::getRole, (a, b) -> "OWNER".equals(a) ? -1 : ("OWNER".equals(b) ? 1 : 0))
                        .thenComparing(RoomParticipantItemResponse::getJoinedAt, Comparator.nullsLast(Comparator.reverseOrder())))
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

        // 이전 방장(나)을 스터디원으로 유지: room_join_request에 승인 행이 없으면 추가 → 스터디원 관리·입장 권한 유지
        if (mapper.countApprovedByEmail(roomId, myEmail) == 0) {
            RoomParticipantVO oldHostVo = mapper.selectUserByEmail(myEmail);
            String nickname = oldHostVo != null ? oldHostVo.getNickname() : null;
            mapper.insertApprovedMember(roomId, myEmail, targetEmail, nickname);
        }

        return new ActionResultResponse(true, "방장 권한을 위임했어요.");
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
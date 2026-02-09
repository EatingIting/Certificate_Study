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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "鈺곕똻???? ??낅뮉 ??쎄숲?遺억폍??낅빍??");
        }

        // ????쎄숲?????꺗(獄쎻뫗???癒?뮉 ?諭??筌롢끇苡?筌??臾롫젏 揶쎛??
        boolean isHost = hostEmail.equals(myEmail);
        int approvedCount = mapper.countApprovedByEmail(roomId, myEmail);
        if (!isHost && approvedCount == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "??쎄숲?遺우뜚筌??臾롫젏??????됰뮸??덈뼄.");
        }

        // 揶쏆늿? room_id: (1) host_user_email(??쎄숲?遺우삢) + (2) status='?諭????request_user_email ?袁⑹뜚
        List<RoomParticipantVO> approved = mapper.selectApprovedParticipants(roomId);

        // ??쎄숲?遺우삢(host_user_email): room?癒?뮉 ??됱몵??room_join_request ?諭????깅퓠 ??곸뱽 ????됱몵沃샕嚥?
        // room_id 疫꿸퀣???곗쨮 獄쎻뫖????곌퐬?袁⑹뱽 ?怨쀪퐨 ?怨몄뒠??곴퐣 鈺곌퀬??
        RoomParticipantVO hostVo = mapper.selectHostParticipant(roomId);
        List<RoomParticipantVO> allParticipants = new ArrayList<>();
        if (hostVo != null) {
            allParticipants.add(hostVo);
        }
        for (RoomParticipantVO v : approved) {
            if (v.getEmail() == null || !v.getEmail().equals(hostEmail)) {
                allParticipants.add(v);
            }
        }

        // ??쎄숲?遺우삢(OWNER) ?믪눘?, 域???쇱벉 ?諭??筌롢끇苡?몴?joinedAt 筌ㅼ뮇???뽰몵嚥?
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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "鈺곕똻???? ??낅뮉 ??쎄숲?遺억폍??낅빍??");
        }

        if (!hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "獄쎻뫗?ｏ쭕?揶쏅벤???????됰뮸??덈뼄.");
        }

        if (request == null || request.getTargetUserId() == null || request.getTargetUserId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetUserId揶쎛 ?袁⑹뒄??몃빍??");
        }

        String targetEmail = mapper.selectEmailByUserId(request.getTargetUserId());
        if (targetEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "?????醫???筌≪뼚??????곷뮸??덈뼄.");
        }

        // 獄쎻뫗??? 揶쏅벤???븍뜃?
        if (hostEmail.equals(targetEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "獄쎻뫗??? ?????????곷뮸??덈뼄.");
        }

        int deleted = mapper.deleteApprovedByEmail(roomId, targetEmail);

        if (deleted == 0) {
            // ??? ??띿뺍椰꾧퀡援??諭??筌롢끇苡?첎? ?袁⑤빜 ????됱벉
            return new ActionResultResponse(false, "?諭???筌롢끇苡?첎? ?袁⑤빍椰꾧퀡援???? 筌ｌ꼶???뤿???щ빍??");
        }

        mapper.upsertLeaveHistory(roomId, targetEmail, "KICK");
        return new ActionResultResponse(true, "??쎄숲?遺우뜚???????됰선??");
    }

    @Override
    public ActionResultResponse transferOwner(String roomId, String myEmail, TransferOwnerRequest request) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "鈺곕똻???? ??낅뮉 ??쎄숲?遺억폍??낅빍??");
        }

        if (!hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "獄쎻뫗?ｏ쭕??袁⑹뿫??????됰뮸??덈뼄.");
        }

        if (request == null || request.getTargetUserId() == null || request.getTargetUserId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetUserId揶쎛 ?袁⑹뒄??몃빍??");
        }

        String targetEmail = mapper.selectEmailByUserId(request.getTargetUserId());
        if (targetEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "?????醫???筌≪뼚??????곷뮸??덈뼄.");
        }

        if (hostEmail.equals(targetEmail)) {
            return new ActionResultResponse(false, "??? 獄쎻뫗???낅빍??");
        }

        // ???怨몄뵠 ?諭??筌롢끇苡?紐? ?類ㅼ뵥(?癒?뮉 host????겹늺 ?袁⑸퓠????? 椰꾨챶??
        int isApproved = mapper.countApprovedByEmail(roomId, targetEmail);
        if (isApproved == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "?諭???筌롢끇苡?癒?쓺筌?獄쎻뫗????袁⑹뿫??????됰뮸??덈뼄.");
        }

        int updated = mapper.updateHostEmail(roomId, targetEmail);
        if (updated == 0) {
            return new ActionResultResponse(false, "獄쎻뫗???袁⑹뿫????쎈솭??됰뮸??덈뼄.");
        }

        // ??곸읈 獄쎻뫗????????쎄숲?遺우뜚??곗쨮 ?醫?: room_join_request???諭????깆뵠 ??곸몵筌??곕떽? ????쎄숲?遺우뜚 ?온??猷뱀뿯??亦낅슦釉??醫?
        if (mapper.countApprovedByEmail(roomId, myEmail) == 0) {
            // ??곸읈 獄쎻뫗???獄쎻뫖????곌퐬?袁⑹뱽 ?醫???띾┛ ?袁る퉸 roomId 疫꿸퀣???곗쨮 鈺곌퀬??
            RoomParticipantVO oldHostVo = mapper.selectHostParticipant(roomId);
            String nickname = oldHostVo != null ? oldHostVo.getNickname() : null;
            mapper.insertApprovedMember(roomId, myEmail, targetEmail, nickname);
        }

        return new ActionResultResponse(true, "獄쎻뫗??亦낅슦釉???袁⑹뿫??됰선??");
    }

    @Override
    public ActionResultResponse verifyLeavePassword(String roomId, String myEmail, VerifyLeaveRoomPasswordRequest request) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "鈺곕똻???? ??낅뮉 ??쎄숲?遺억폍??낅빍??");
        }

        // 獄쎻뫗??? ??딅닚 ?븍뜃? ???대끃????쑬苡?野꺜筌앹빜釉??袁⑹뒄????곸몵????由??筌△뫀??
        if (hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "獄쎻뫗??? ??딅닚??????곷뮸??덈뼄. 獄쎻뫗???袁⑹뿫 ????딅닚??뤾쉭??");
        }

        // ?諭??筌롢끇苡?첎? ?袁⑤빍筌?野꺜筌???딅닚 ?????븍뜃???띿쓺(筌왖疫?leaveRoom?????類ㅼ퐠 ???뵬)
        int isApproved = mapper.countApprovedByEmail(roomId, myEmail);
        if (isApproved == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "?諭???筌롢끇苡?쭕???딅닚??????됰뮸??덈뼄.");
        }

        if (request == null || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "??쑬?甕곕뜇?뉒몴???낆젾??雅뚯눘苑??");
        }

        // users 鈺곌퀬??疫꿸퀣??嚥≪뮄??紐꾠걹 mapper ??沅??
        com.example.demo.로그인.vo.AuthVO user = authMapper.findByEmail(myEmail);
        if (user == null || user.getPassword() == null || user.getPassword().isBlank()) {
            // ?④쑴??鈺곕똻????????紐꾪뀱??? ??낅즲嚥?筌롫뗄?놅쭪? ??λ떄??
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "??쑬?甕곕뜇?뉐첎? ??깊뒄??? ??녿뮸??덈뼄.");
        }

        boolean ok = passwordEncoder.matches(request.getPassword(), user.getPassword());
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "??쑬?甕곕뜇?뉐첎? ??깊뒄??? ??녿뮸??덈뼄.");
        }

        return new ActionResultResponse(true, "??쑬?甕곕뜇???類ㅼ뵥 ?袁⑥┷");
    }

    @Override
    public ActionResultResponse leaveRoom(String roomId, String myEmail) {

        String hostEmail = mapper.selectHostEmail(roomId);
        if (hostEmail == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "鈺곕똻???? ??낅뮉 ??쎄숲?遺억폍??낅빍??");
        }

        // 獄쎻뫗??? ??딅닚 ?븍뜃?(?袁⑹뿫 ?????????
        if (hostEmail.equals(myEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "獄쎻뫗??? ??딅닚??????곷뮸??덈뼄. 獄쎻뫗???袁⑹뿫 ????딅닚??뤾쉭??");
        }

        int deleted = mapper.deleteApprovedByEmail(roomId, myEmail);
        if (deleted == 0) {
            return new ActionResultResponse(false, "?諭???筌롢끇苡?첎? ?袁⑤빍椰꾧퀡援???? ??딅닚??뤿???щ빍??");
        }

        mapper.upsertLeaveHistory(roomId, myEmail, "LEAVE");
        return new ActionResultResponse(true, "??쎄숲?遺억폍?癒?퐣 ??딅닚??됰선??");
    }
}

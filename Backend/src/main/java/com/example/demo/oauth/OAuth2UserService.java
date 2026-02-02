package com.example.demo.oauth;

import com.example.demo.로그인.mapper.AuthMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OAuth2UserService extends DefaultOAuth2UserService {

    private final AuthMapper authMapper;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) {

        OAuth2User user = super.loadUser(request);

        String provider =
                request.getClientRegistration().getRegistrationId();

        String email = null;
        String nickname = null;
        String stableId = null;

        if (provider.equals("kakao")) {

            Map<String, Object> attributes = user.getAttributes();

            Map<String, Object> kakaoAccount =
                    (Map<String, Object>) attributes.get("kakao_account");

            // kakao는 최상위에 id가 존재
            Object idObj = attributes.get("id");
            stableId = idObj != null ? String.valueOf(idObj) : null;

            if (kakaoAccount != null) {
                email = (String) kakaoAccount.get("email");
            }

            Map<String, Object> properties =
                    (Map<String, Object>) attributes.get("properties");

            if (properties != null) {
                nickname = (String) properties.get("nickname");
            }

        }

        else if (provider.equals("google")) {

            email = user.getAttribute("email");
            nickname = user.getAttribute("name");
            // google은 sub가 안정적인 식별자
            Object sub = user.getAttribute("sub");
            stableId = sub != null ? String.valueOf(sub) : null;

        }

        else if (provider.equals("naver")) {

            Map<String, Object> attributes = user.getAttributes();

            Map<String, Object> response =
                    (Map<String, Object>) attributes.get("response");

            if (response != null) {
                email = (String) response.get("email");
                nickname = (String) response.get("name");
                Object id = response.get("id");
                stableId = id != null ? String.valueOf(id) : null;
            }
        }

        // ✅ email이 null/빈값인 경우(카카오/네이버에서 이메일 미제공 등)도 절대 500이 나지 않게 처리
        // - 기존 로직은 email 기반 사용자 조회/토큰 발급이므로, 안정적인 "대체 이메일"을 생성해 흐름이 끊기지 않게 한다.
        if (email == null || email.trim().isEmpty()) {
            String fallbackId = (stableId != null && !stableId.isEmpty())
                    ? stableId
                    : String.valueOf(System.currentTimeMillis());
            email = provider + "_" + fallbackId + "@oauth.local";
        }

        boolean exists = authMapper.countByEmail(email) > 0;

        return new DefaultOAuth2User(
                List.of(() -> "ROLE_USER"),
                Map.of(
                        "email", email,
                        "nickname", nickname,
                        "exists", exists,
                        "provider", provider
                ),
                "email"
        );
    }
}

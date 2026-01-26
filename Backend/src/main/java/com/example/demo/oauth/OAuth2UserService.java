package com.example.demo.oauth;

import com.example.demo.auth.AuthMapper;
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

        if (provider.equals("kakao")) {

            Map<String, Object> attributes = user.getAttributes();

            Map<String, Object> kakaoAccount =
                    (Map<String, Object>) attributes.get("kakao_account");

            email = (String) kakaoAccount.get("email");

            Map<String, Object> properties =
                    (Map<String, Object>) attributes.get("properties");

            nickname = (String) properties.get("nickname");

        }

        else if (provider.equals("google")) {

            email = user.getAttribute("email");
            nickname = user.getAttribute("name");

        }

        else if (provider.equals("naver")) {

            Map<String, Object> attributes = user.getAttributes();

            Map<String, Object> response =
                    (Map<String, Object>) attributes.get("response");

            email = (String) response.get("email");
            nickname = (String) response.get("name");
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

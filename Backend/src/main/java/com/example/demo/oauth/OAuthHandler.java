package com.example.demo.oauth;

import com.example.demo.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuthHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;

    public OAuthHandler(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication)
            throws IOException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String email = oauthUser.getAttribute("email");
        Boolean exists = oauthUser.getAttribute("exists");
        String provider = oauthUser.getAttribute("provider");

        String frontUrl =
                request.getScheme() + "://" + request.getServerName() + ":3000";

        if (exists != null && exists) {

            String token = jwtTokenProvider.createAccessToken(email);

            response.sendRedirect(
                    frontUrl + "/oauth-success?token=" + token
            );
        }

        else {

            String encodedEmail = URLEncoder.encode(
                    email,
                    StandardCharsets.UTF_8
            );

            response.sendRedirect(
                    frontUrl + "/signup"
                            + "?email=" + encodedEmail
                            + "&provider=" + provider
            );
        }
    }
}

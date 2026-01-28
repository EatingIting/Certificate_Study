package com.example.demo.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuthFailHandler extends SimpleUrlAuthenticationFailureHandler {

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception)
            throws IOException {

        String msg = URLEncoder.encode(
                exception.getMessage(),
                StandardCharsets.UTF_8
        );

        String frontUrl =
                request.getScheme() + "://" + request.getServerName() + ":3000";

        response.sendRedirect(
                frontUrl + "/oauth-fail?error=" + msg
        );
    }
}

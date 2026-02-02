package com.example.demo.security;

import com.example.demo.jwt.JwtAuthFilter;
import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.oauth.OAuthHandler;
import com.example.demo.oauth.OAuthFailHandler;
import com.example.demo.oauth.OAuth2UserService;
import com.example.demo.oauth.OAuthRedirectOriginFilter;
import com.example.demo.oauth.HttpCookieOAuth2AuthorizationRequestRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final OAuthHandler oAuthHandler;
    private final OAuthFailHandler oAuthFailHandler;
    private final OAuth2UserService oAuth2UserService;
    private final OAuthRedirectOriginFilter oAuthRedirectOriginFilter;
    private final HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository;

    public SecurityConfig(JwtTokenProvider jwtTokenProvider,
                          OAuthHandler oAuthHandler,
                          OAuthFailHandler oAuthFailHandler,
                          OAuth2UserService oAuth2UserService,
                          OAuthRedirectOriginFilter oAuthRedirectOriginFilter,
                          HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.oAuthHandler = oAuthHandler;
        this.oAuthFailHandler = oAuthFailHandler;
        this.oAuth2UserService = oAuth2UserService;
        this.oAuthRedirectOriginFilter = oAuthRedirectOriginFilter;
        this.cookieAuthorizationRequestRepository = cookieAuthorizationRequestRepository;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())

                .sessionManagement(sm ->
                        sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .authorizeHttpRequests(auth -> auth

                        .requestMatchers("/files/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()

                        .requestMatchers(
                                "/", "/index.html",
                                "/static/**",
                                "/*.css", "/*.js",
                                "/*.png", "/*.jpg", "/*.jpeg",
                                "/*.svg", "/*.ico",
                                "/assets/**",
                                "/images/**",
                                "/upload/**"
                        ).permitAll()

                        .requestMatchers(
                                "/api/users/login",
                                "/api/users/signup",
                                "/api/users/check-email",
                                "/api/category/**",
                                "/api/meeting-rooms/**"
                        ).permitAll()

                        .requestMatchers("/api/rooms/interest").authenticated()

                        // LMS 관련 API는 인증 필수
                        .requestMatchers("/api/classrooms/**").authenticated()
                        .requestMatchers("/api/board/**").authenticated()
                        .requestMatchers("/api/schedules/**").authenticated()
                        .requestMatchers("/api/study-schedules/**").authenticated()
                        .requestMatchers("/api/rooms/{roomId}/schedule/**").authenticated()
                        .requestMatchers("/api/users/me").authenticated()

                        .requestMatchers("/api/rooms/**").permitAll()

                        .requestMatchers("/ws/**").permitAll()

                        .anyRequest().authenticated()
                )

                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> {
                            if (request.getRequestURI().startsWith("/api/")) {
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                                response.setContentType("application/json;charset=UTF-8");
                                response.getWriter().write(
                                        "{\"error\":\"Unauthorized\",\"message\":\"인증이 필요합니다.\"}"
                                );
                            } else {
                                response.sendRedirect("/login");
                            }
                        })
                )

                .oauth2Login(oauth -> oauth
                        .authorizationEndpoint(authorization ->
                                authorization.authorizationRequestRepository(cookieAuthorizationRequestRepository)
                        )
                        .userInfoEndpoint(userInfo ->
                                userInfo.userService(oAuth2UserService)
                        )
                        .successHandler(oAuthHandler)
                        .failureHandler(oAuthFailHandler)
                )

                .addFilterBefore(
                        oAuthRedirectOriginFilter,
                        UsernamePasswordAuthenticationFilter.class
                )
                .addFilterBefore(
                        new JwtAuthFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}

package com.example.demo.security;

import com.example.demo.jwt.JwtAuthFilter;
import com.example.demo.jwt.JwtTokenProvider;
import com.example.demo.oauth.OAuthHandler;
import com.example.demo.oauth.OAuth2UserService;
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
    private final OAuth2UserService oAuth2UserService;

    public SecurityConfig(JwtTokenProvider jwtTokenProvider,
                          OAuthHandler oAuthHandler,
                          OAuth2UserService oAuth2UserService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.oAuthHandler = oAuthHandler;
        this.oAuth2UserService = oAuth2UserService;
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
                                "/api/rooms/**",
                                "/api/meeting-rooms/**"
                        ).permitAll()

                        .requestMatchers("/api/ai/**").permitAll() // AI API 관련 허용

                        //웹소켓 경로
                        .requestMatchers("/ws/**")
                        .permitAll()

                        .anyRequest().authenticated()
                )
                
                // 인증 실패 시 리다이렉트 대신 401 JSON 응답 반환
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> {
                            // API 요청인 경우 JSON 응답
                            if (request.getRequestURI().startsWith("/api/")) {
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                                response.setContentType("application/json;charset=UTF-8");
                                response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"인증이 필요합니다.\"}");
                            } else {
                                // 일반 요청은 기존대로 리다이렉트
                                response.sendRedirect("/login");
                            }
                        })
                )

                // OAuth 로그인 시 이메일 가져오도록 설정
                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(userInfo ->
                                userInfo.userService(oAuth2UserService)
                        )
                        .successHandler(oAuthHandler)
                )

                .addFilterBefore(
                        new JwtAuthFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    // CORS 설정
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(false); // allowCredentials와 "*" origin은 함께 사용 불가
        config.setMaxAge(3600L); // preflight 캐시 시간

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }

    // 비밀번호 암호화
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // AI chat 관련
    @Bean
    public org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer webSecurityCustomizer() {
        // AI, 웹소켓, 정적 리소스는 보안 필터를 아예 거치지 않게 설정 (무조건 통과)
        return (web) -> web.ignoring()
                .requestMatchers("/api/ai/**", "/ws/**", "/css/**", "/js/**", "/images/**", "/favicon.ico");
    }
}

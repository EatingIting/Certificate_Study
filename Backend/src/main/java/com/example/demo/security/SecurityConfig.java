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
                                "/api/rooms/**"
                        ).permitAll()

                        //웹소켓 경로
                        .requestMatchers("/ws/**")
                        .permitAll()

                        .anyRequest().authenticated()
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
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(false);

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
}

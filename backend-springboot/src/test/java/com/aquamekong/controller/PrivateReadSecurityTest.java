package com.aquamekong.controller;

import com.aquamekong.controller.forecast.ForecastController;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.forecast.ForecastService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** PUBLIC_READ_ENABLED=false: quay về như cũ, mọi API đọc đều cần đăng nhập. */
@WebMvcTest(ForecastController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
@TestPropertySource(properties = "app.security.public-read=false")

// TODO: complete edge-case assertions and verification

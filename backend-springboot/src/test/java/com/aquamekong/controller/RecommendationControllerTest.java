package com.aquamekong.controller;

import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.RecommendationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecommendationController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
class RecommendationControllerTest {

    @Autowired MockMvc mvc;
    @MockBean RecommendationService recommendationService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void guestsGetTheGeneralRecommendations() throws Exception {
        mvc.perform(get("/api/v1/recommendations")).andExpect(status().isOk());
        verify(recommendationService).getRecommendations(isNull());
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void signedInUserGetsRecommendationsForTheirFields() throws Exception {
        mvc.perform(get("/api/v1/recommendations")).andExpect(status().isOk());
        verify(recommendationService).getRecommendations("alice");
    }
}

package com.aquamekong.controller;

import com.aquamekong.controller.forecast.ForecastAccuracyController;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.forecast.ForecastAccuracyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ForecastAccuracyController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
class ForecastAccuracyControllerTest {

    @Autowired MockMvc mvc;
    @MockBean ForecastAccuracyService accuracyService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void anonymousUsersCanSeeHowAccurateForecastsAre() throws Exception {
        when(accuracyService.accuracy(180)).thenReturn(Map.of("modelVersion", "statistical-v2"));
        when(accuracyService.verification(3L, 30)).thenReturn(List.of());

        mvc.perform(get("/api/v1/forecasts/accuracy")).andExpect(status().isOk())
                .andExpect(jsonPath("$.modelVersion").value("statistical-v2"));
        mvc.perform(get("/api/v1/forecasts/station/3/verification")).andExpect(status().isOk());
    }
}

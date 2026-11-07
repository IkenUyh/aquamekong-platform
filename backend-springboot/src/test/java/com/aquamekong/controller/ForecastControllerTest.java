package com.aquamekong.controller;

import com.aquamekong.controller.forecast.ForecastController;
import com.aquamekong.exception.MlServiceException;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.forecast.ForecastService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Mã lỗi HTTP do GlobalExceptionHandler trả về + quy tắc phân quyền của SecurityConfig.
 */
@WebMvcTest(ForecastController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
@WithMockUser(roles = "ADMIN")
class ForecastControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @MockBean ForecastService forecastService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void modelInfoIsPublicAnd404WhenNoModelInstalled() throws Exception {
        when(forecastService.stgnnModelInfo()).thenReturn(java.util.Optional.empty());
        mvc.perform(get("/api/v1/forecasts/model-info")).andExpect(status().isNotFound());

        when(forecastService.stgnnModelInfo()).thenReturn(java.util.Optional.of(java.util.Map.of("model_version", "st-gnn-v1")));
        mvc.perform(get("/api/v1/forecasts/model-info"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("st-gnn-v1")));
    }

    @Test
    void predictValidatesDaysAhead() throws Exception {
        mvc.perform(post("/api/v1/forecasts/predict").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stationId\":1,\"daysAhead\":99}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedJsonIsBadRequest() throws Exception {
        mvc.perform(post("/api/v1/forecasts/predict").contentType(MediaType.APPLICATION_JSON).content("{bad"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mlFailureIsBadGateway() throws Exception {
        when(forecastService.predict(anyLong(), anyInt())).thenThrow(new MlServiceException("ML down"));
        mvc.perform(post("/api/v1/forecasts/predict").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stationId\":1,\"daysAhead\":7}"))
                .andExpect(status().isBadGateway());
    }

    @Test
    void missingRunIsNotFound() throws Exception {
        when(forecastService.getRunById(5L)).thenThrow(new EntityNotFoundException("not found"));
        mvc.perform(get("/api/v1/forecasts/runs/5")).andExpect(status().isNotFound());

// TODO: complete edge-case assertions and verification

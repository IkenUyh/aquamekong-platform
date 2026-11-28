package com.aquamekong.controller;

import com.aquamekong.controller.field.QuickPlanController;
import com.aquamekong.dto.field.FieldDtos.FieldPlan;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.field.QuickPlanService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Tra nhanh công khai kể cả khi tắt PUBLIC_READ_ENABLED, như hồ sơ ruộng */
@WebMvcTest(QuickPlanController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
@TestPropertySource(properties = "app.security.public-read=false")
class QuickPlanControllerTest {

    @Autowired MockMvc mvc;
    @MockBean QuickPlanService quickPlanService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void guestsGetThePlanForAStationAndCrop() throws Exception {
        when(quickPlanService.plan(3L, "lua", LocalDate.of(2026, 11, 1), 95)).thenReturn(Optional.of(
                new FieldPlan("GREEN", "Có, cả tuần nước sông trong ngưỡng.", List.of(), null)));

        mvc.perform(get("/api/v1/plan/quick").param("stationId", "3").param("cropCode", "lua")
                        .param("plantedOn", "2026-11-01").param("varietyDays", "95"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("GREEN"))
                .andExpect(jsonPath("$.headline").value("Có, cả tuần nước sông trong ngưỡng."));
    }

    @Test
    @WithAnonymousUser
    void noContentWhenThePlanCannotBeMade() throws Exception {
        when(quickPlanService.plan(3L, "dua", null, null)).thenReturn(Optional.empty());
        mvc.perform(get("/api/v1/plan/quick").param("stationId", "3").param("cropCode", "dua"))
                .andExpect(status().isNoContent());
        verify(quickPlanService).plan(eq(3L), eq("dua"), isNull(), isNull());
    }

    @Test
    @WithAnonymousUser
    void badInputIsAClientError() throws Exception {
        mvc.perform(get("/api/v1/plan/quick").param("cropCode", "lua")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/plan/quick").param("stationId", "3").param("cropCode", "lua")
                .param("plantedOn", "01/11/2026")).andExpect(status().isBadRequest());
        verify(quickPlanService, never()).plan(anyLong(), any(), any(), any());

        when(quickPlanService.plan(3L, "lua", null, 95)).thenThrow(new IllegalArgumentException("Cần ngày gieo"));
        mvc.perform(get("/api/v1/plan/quick").param("stationId", "3").param("cropCode", "lua").param("varietyDays", "95"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cần ngày gieo"));

        when(quickPlanService.plan(99L, "lua", null, null)).thenThrow(new EntityNotFoundException("Không tìm thấy trạm: 99"));
        mvc.perform(get("/api/v1/plan/quick").param("stationId", "99").param("cropCode", "lua"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithAnonymousUser
    void onlyGetIsOpen() throws Exception {
        mvc.perform(post("/api/v1/plan/quick").param("stationId", "3").param("cropCode", "lua"))
                .andExpect(status().isUnauthorized());
    }
}

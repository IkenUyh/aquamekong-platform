package com.aquamekong.controller;

import com.aquamekong.controller.crop.CropController;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.crop.CropService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CropController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
class CropControllerTest {

    @Autowired MockMvc mvc;
    @MockBean CropService cropService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void anonymousCanReadTheCropTable() throws Exception {
        when(cropService.list()).thenReturn(List.of());
        mvc.perform(get("/api/v1/crops")).andExpect(status().isOk());
    }

    @Test
    @WithAnonymousUser
    void anonymousCannotWrite() throws Exception {
        mvc.perform(post("/api/v1/crops")).andExpect(status().isUnauthorized());
    }
}

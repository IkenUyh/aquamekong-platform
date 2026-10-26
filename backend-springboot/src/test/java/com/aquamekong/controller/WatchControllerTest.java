package com.aquamekong.controller;

import com.aquamekong.controller.watch.WatchController;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.watch.StationWatchService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WatchController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
class WatchControllerTest {

    private static final String BODY = """
            {"stationId":3,"threshold":2,"crop":"Lúa"}""";

    @Autowired MockMvc mvc;
    @MockBean StationWatchService watchService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void anonymousCannotListOrWatch() throws Exception {
        mvc.perform(get("/api/v1/watches")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/watches").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(watchService);
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void selfRegisteredUserCanWatchAndUnwatch() throws Exception {
        mvc.perform(post("/api/v1/watches").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk());
        verify(watchService).save(eq("alice"), any());

        mvc.perform(delete("/api/v1/watches/5")).andExpect(status().isNoContent());
        verify(watchService).delete("alice", 5L);
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void thresholdMustBeAPlausibleSalinity() throws Exception {
        mvc.perform(post("/api/v1/watches").contentType(MediaType.APPLICATION_JSON).content("""
                        {"stationId":3,"threshold":0}"""))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/watches").contentType(MediaType.APPLICATION_JSON).content("""
                        {"stationId":3,"threshold":120}"""))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(watchService);
    }
}

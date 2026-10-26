package com.aquamekong.controller;

import com.aquamekong.controller.push.PushController;
import com.aquamekong.dto.push.PushConfigDto;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.push.PushService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PushController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
class PushControllerTest {

    private static final String SUBSCRIBE_BODY = """
            {"channel":"WEBPUSH","endpoint":"https://fcm.googleapis.com/fcm/send/abc","p256dh":"k","auth":"a"}""";

    @Autowired MockMvc mvc;
    @MockBean PushService pushService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void anonymousCannotSubscribe() throws Exception {
        mvc.perform(post("/api/v1/push/subscriptions").contentType(MediaType.APPLICATION_JSON).content(SUBSCRIBE_BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(pushService);
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void selfRegisteredUserCanSubscribe() throws Exception {
        mvc.perform(post("/api/v1/push/subscriptions").contentType(MediaType.APPLICATION_JSON).content(SUBSCRIBE_BODY))
                .andExpect(status().isNoContent());
        verify(pushService).subscribe(eq("alice"), any());
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void subscribeValidatesBody() throws Exception {
        mvc.perform(post("/api/v1/push/subscriptions").contentType(MediaType.APPLICATION_JSON).content("{\"channel\":\"WEBPUSH\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(pushService);
    }

    @Test
    @WithMockUser(username = "dev", roles = "DEVICE")
    void ingestDeviceCannotSubscribe() throws Exception {
        mvc.perform(post("/api/v1/push/subscriptions").contentType(MediaType.APPLICATION_JSON).content(SUBSCRIBE_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void configReturnsVapidKey() throws Exception {
        when(pushService.config()).thenReturn(new PushConfigDto("BPub", false));

        mvc.perform(get("/api/v1/push/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.webPushPublicKey").value("BPub"))
                .andExpect(jsonPath("$.fcmEnabled").value(false));
    }
}

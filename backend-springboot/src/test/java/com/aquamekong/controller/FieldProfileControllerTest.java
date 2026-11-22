package com.aquamekong.controller;

import com.aquamekong.controller.field.FieldProfileController;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.field.FieldProfileService;
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

@WebMvcTest(FieldProfileController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
class FieldProfileControllerTest {

    private static final String BODY = """
            {"name":"Ruộng sau nhà","stationId":3,"cropCode":"lua","varietyDays":95,"plantedOn":"2026-11-01",
             "areaHa":1.5,"hasPond":true,"pondVolumeM3":800}""";

    @Autowired MockMvc mvc;
    @MockBean FieldProfileService fieldService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    @WithAnonymousUser
    void anonymousCannotReadOrWriteFields() throws Exception {
        mvc.perform(get("/api/v1/fields")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/fields").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(fieldService);
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void selfRegisteredUserManagesOwnFields() throws Exception {
        mvc.perform(post("/api/v1/fields").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated());
        verify(fieldService).create(eq("alice"), any());

        mvc.perform(delete("/api/v1/fields/9")).andExpect(status().isNoContent());
        verify(fieldService).delete("alice", 9L);
    }

    @Test
    @WithMockUser(username = "alice", roles = "USER")
    void invalidValuesAreRejected() throws Exception {
        mvc.perform(post("/api/v1/fields").contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":" ","stationId":3,"cropCode":"lua"}"""))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/fields").contentType(MediaType.APPLICATION_JSON).content("""
                        {"name":"Ruộng","stationId":3,"cropCode":"lua","areaHa":-1}"""))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(fieldService);
    }
}

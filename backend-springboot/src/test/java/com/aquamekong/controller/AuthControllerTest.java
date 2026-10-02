package com.aquamekong.controller;

import com.aquamekong.controller.auth.AuthController;
import com.aquamekong.dto.auth.AuthConfigDto;
import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.security.JsonAuthErrorHandler;
import com.aquamekong.security.JwtService;
import com.aquamekong.security.SecurityConfig;
import com.aquamekong.service.auth.AuthService;
import com.aquamekong.service.auth.ExternalAuthService;
import com.aquamekong.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtService.class, JsonAuthErrorHandler.class})
@WithAnonymousUser
class AuthControllerTest {

    @Autowired MockMvc mvc;
    @MockBean AuthService authService;
    @MockBean UserService userService;
    @MockBean ExternalAuthService externalAuthService;
    @MockBean UserDetailsService userDetailsService;

    private static final LoginResponse OK = new LoginResponse("t", "Bearer", 60, new UserDto());

    @Test
    void configIsPublic() throws Exception {
        when(authService.config()).thenReturn(new AuthConfigDto(true, true, "cid", "zalo-app"));
        mvc.perform(get("/api/v1/auth/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleClientId").value("cid"));
    }

    @Test
    void registerIsPublicAndReturnsToken() throws Exception {
        when(authService.register(any())).thenReturn(OK);
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nong_dan\",\"email\":\"a@b.vn\",\"password\":\"12345678\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").value("t"));
    }

    @Test
    void registerValidatesUsernameAndPassword() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"có dấu\",\"email\":\"a@b.vn\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest());
        verify(authService, never()).register(any());
    }

    @Test
    void registerCannotSmuggleRoles() throws Exception {
        when(authService.register(any())).thenReturn(OK);
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nong_dan\",\"email\":\"a@b.vn\",\"password\":\"12345678\",\"roles\":[\"ROLE_ADMIN\"]}"))
                .andExpect(status().isCreated());
        // RegisterRequest không có trường roles; AuthService.register luôn tạo ROLE_USER
        verify(authService).register(argThat(r -> r.username().equals("nong_dan")));
    }

    @Test
    void closedRegistrationIsForbiddenWithReadableMessage() throws Exception {
        when(authService.register(any())).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Hệ thống chưa mở đăng ký"));
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nong_dan\",\"email\":\"a@b.vn\",\"password\":\"12345678\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Hệ thống chưa mở đăng ký"));
    }

    @Test
    void googleLoginIsPublic() throws Exception {
        when(externalAuthService.loginWithGoogle("id-token")).thenReturn(OK);
        mvc.perform(post("/api/v1/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"idToken\":\"id-token\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void zaloLoginIsPublicAndValidatesVerifier() throws Exception {
        String verifier = "a".repeat(43);
        when(externalAuthService.loginWithZalo("c", verifier)).thenReturn(OK);
        mvc.perform(post("/api/v1/auth/zalo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"c\",\"codeVerifier\":\"" + verifier + "\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/zalo").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"c\",\"codeVerifier\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void identitiesRequireLogin() throws Exception {
        mvc.perform(get("/api/v1/auth/identities")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/identities/google").contentType(MediaType.APPLICATION_JSON).content("{\"idToken\":\"x\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/identities/zalo").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}

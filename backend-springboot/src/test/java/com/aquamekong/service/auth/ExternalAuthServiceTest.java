package com.aquamekong.service.auth;

import com.aquamekong.client.ZaloOAuthClient;
import com.aquamekong.dto.auth.LoginResponse;
import com.aquamekong.dto.user.UserDto;
import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.entity.user.User;
import com.aquamekong.entity.user.UserIdentity;
import com.aquamekong.repository.user.UserIdentityRepository;
import com.aquamekong.repository.user.UserRepository;
import com.aquamekong.security.ExternalProfile;
import com.aquamekong.security.GoogleIdTokenVerifier;
import com.aquamekong.service.user.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalAuthServiceTest {

    @Mock GoogleIdTokenVerifier googleVerifier;
    @Mock ZaloOAuthClient zaloClient;
    @Mock UserIdentityRepository identityRepository;
    @Mock UserRepository userRepository;
    @Mock UserService userService;
    @Mock AuthService authService;
    @Mock LoginMethodGuard loginMethodGuard;
    @InjectMocks ExternalAuthService service;

    private static final ExternalProfile PROFILE =
            new ExternalProfile("google", "sub-1", "a@gmail.com", true, "Nguyễn Văn A");

    private final User alice = User.builder().id(1L).username("alice").status(UserStatus.ACTIVE).build();
    private final LoginResponse response = new LoginResponse("token", "Bearer", 60, new UserDto());

    @Test
    void knownIdentityLogsIn() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        UserIdentity identity = UserIdentity.builder().user(alice).provider("google").providerUserId("sub-1").build();
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.of(identity));
        when(authService.issueToken(any())).thenReturn(response);

        assertThat(service.loginWithGoogle("tok")).isSameAs(response);
        assertThat(identity.getLastLoginAt()).isNotNull();
        verify(userService, never()).createExternalUser(anyString(), anyString());
    }

    @Test
    void lockedUserCannotLogInWithGoogle() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        alice.setStatus(UserStatus.SUSPENDED);
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1"))
                .thenReturn(Optional.of(UserIdentity.builder().user(alice).build()));

        assertThatThrownBy(() -> service.loginWithGoogle("tok")).isInstanceOf(DisabledException.class);
        verify(authService, never()).issueToken(any());
    }

    @Test
    void newGoogleAccountCreatesUserAndIdentity() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("a@gmail.com")).thenReturn(false);
        when(userService.createExternalUser("a@gmail.com", "Nguyễn Văn A")).thenReturn(alice);
        when(authService.issueToken(any())).thenReturn(response);

        service.loginWithGoogle("tok");

        ArgumentCaptor<UserIdentity> saved = ArgumentCaptor.forClass(UserIdentity.class);
        verify(identityRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(alice);
        assertThat(saved.getValue().getProviderUserId()).isEqualTo("sub-1");
    }

    @Test
    void doesNotMergeIntoExistingAccountByEmail() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("a@gmail.com")).thenReturn(true);

        assertThatThrownBy(() -> service.loginWithGoogle("tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(userService, never()).createExternalUser(anyString(), anyString());
        verify(identityRepository, never()).save(any());
    }

    @Test
    void unverifiedEmailCannotRegister() {
        when(googleVerifier.verify("tok")).thenReturn(new ExternalProfile("google", "sub-1", "a@gmail.com", false, null));
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loginWithGoogle("tok")).isInstanceOf(BadCredentialsException.class);
        verify(userService, never()).createExternalUser(anyString(), anyString());
    }

    @Test
    void closedRegistrationBlocksNewGoogleAccounts() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN)).when(authService).requireRegistrationEnabled();

        assertThatThrownBy(() -> service.loginWithGoogle("tok")).isInstanceOf(ResponseStatusException.class);
        verify(userService, never()).createExternalUser(anyString(), anyString());
    }

    @Test
    void cannotLinkGoogleAccountOwnedBySomeoneElse() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        User bob = User.builder().id(2L).username("bob").build();
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1"))
                .thenReturn(Optional.of(UserIdentity.builder().user(bob).build()));

        assertThatThrownBy(() -> service.linkGoogle("alice", "tok")).isInstanceOf(ResponseStatusException.class);
        verify(identityRepository, never()).save(any());
    }

    @Test
    void linkSavesIdentityForCurrentUser() {
        when(googleVerifier.verify("tok")).thenReturn(PROFILE);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(identityRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());

        service.linkGoogle("alice", "tok");

        verify(identityRepository).save(argThat(i -> i.getUser() == alice && "sub-1".equals(i.getProviderUserId())));
    }

    @Test
    void cannotUnlinkLastLoginMethod() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(identityRepository.existsByUserIdAndProvider(1L, "google")).thenReturn(true);
        doThrow(new IllegalArgumentException("last")).when(loginMethodGuard).requireAnotherMethod(alice);

        assertThatThrownBy(() -> service.unlink("alice", "google")).isInstanceOf(IllegalArgumentException.class);
        verify(identityRepository, never()).deleteByUserIdAndProvider(anyLong(), anyString());
    }

    @Test
    void canUnlinkWhenAnotherMethodExists() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(identityRepository.existsByUserIdAndProvider(1L, "google")).thenReturn(true);

        service.unlink("alice", "google");

        verify(identityRepository).deleteByUserIdAndProvider(1L, "google");
    }

    // ===== Zalo =====

    private static final ExternalProfile ZALO = new ExternalProfile("zalo", "5001", null, false, "Nguyễn Văn An");

    @Test
    void newZaloAccountIsCreatedWithoutEmail() {
        when(zaloClient.exchange("code", "verifier")).thenReturn(ZALO);
        when(identityRepository.findByProviderAndProviderUserId("zalo", "5001")).thenReturn(Optional.empty());
        when(userService.createExternalUser(null, "Nguyễn Văn An")).thenReturn(alice);
        when(authService.issueToken(any())).thenReturn(response);

        assertThat(service.loginWithZalo("code", "verifier")).isSameAs(response);

        verify(userRepository, never()).existsByEmailIgnoreCase(any());
        verify(identityRepository).save(argThat(i -> "zalo".equals(i.getProvider()) && i.getEmail() == null));
    }

    @Test
    void knownZaloIdentityLogsIn() {
        when(zaloClient.exchange("code", "verifier")).thenReturn(ZALO);
        when(identityRepository.findByProviderAndProviderUserId("zalo", "5001"))
                .thenReturn(Optional.of(UserIdentity.builder().user(alice).provider("zalo").providerUserId("5001").build()));
        when(authService.issueToken(any())).thenReturn(response);

        service.loginWithZalo("code", "verifier");

        verify(userService, never()).createExternalUser(any(), any());
    }

    @Test
    void linkZaloUsesProviderNameInConflictMessage() {
        when(zaloClient.exchange("code", "verifier")).thenReturn(ZALO);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(identityRepository.findByProviderAndProviderUserId("zalo", "5001"))
                .thenReturn(Optional.of(UserIdentity.builder().user(User.builder().id(2L).build()).build()));

        assertThatThrownBy(() -> service.linkZalo("alice", "code", "verifier"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Zalo");
    }
}

package com.aquamekong.service.auth;

import com.aquamekong.entity.user.User;
import com.aquamekong.repository.user.UserIdentityRepository;
import com.aquamekong.repository.user.UserPasskeyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginMethodGuardTest {

    @Mock UserIdentityRepository identityRepository;
    @Mock UserPasskeyRepository passkeyRepository;
    @InjectMocks LoginMethodGuard guard;

    private final User noPassword = User.builder().id(1L).build();

    @Test
    void onlyPasskeyCannotBeRemoved() {
        when(identityRepository.countByUserId(1L)).thenReturn(0L);
        when(passkeyRepository.countByUserId(1L)).thenReturn(1L);
        assertThatThrownBy(() -> guard.requireAnotherMethod(noPassword)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void onlyZaloCannotBeRemoved() {
        when(identityRepository.countByUserId(1L)).thenReturn(1L);
        when(passkeyRepository.countByUserId(1L)).thenReturn(0L);
        assertThatThrownBy(() -> guard.requireAnotherMethod(noPassword)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void zaloPlusPasskeyAllowsRemovingOne() {
        when(identityRepository.countByUserId(1L)).thenReturn(1L);
        when(passkeyRepository.countByUserId(1L)).thenReturn(1L);
        assertThatCode(() -> guard.requireAnotherMethod(noPassword)).doesNotThrowAnyException();
    }

    @Test
    void passwordCountsAsAMethod() {
        User withPassword = User.builder().id(1L).passwordHash("$2a$x").build();
        when(identityRepository.countByUserId(1L)).thenReturn(0L);
        when(passkeyRepository.countByUserId(1L)).thenReturn(1L);
        assertThatCode(() -> guard.requireAnotherMethod(withPassword)).doesNotThrowAnyException();
    }
}

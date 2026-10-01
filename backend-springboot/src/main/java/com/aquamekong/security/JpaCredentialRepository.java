package com.aquamekong.security;

import com.aquamekong.entity.user.UserPasskey;
import com.aquamekong.repository.user.UserPasskeyRepository;
import com.aquamekong.repository.user.UserRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Cầu nối thư viện Yubico WebAuthn với bảng users / user_passkeys. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JpaCredentialRepository implements CredentialRepository {

    private final UserRepository userRepository;
    private final UserPasskeyRepository passkeyRepository;

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return userRepository.findByUsername(username)
                .map(u -> passkeyRepository.findByUserIdOrderByCreatedAtAsc(u.getId()).stream()
                        .map(p -> PublicKeyCredentialDescriptor.builder().id(new ByteArray(p.getCredentialId())).build())
                        .collect(Collectors.toSet()))
                .orElse(Set.of());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return userRepository.findByUsername(username)
                .map(u -> u.getWebauthnUserHandle())
                .map(ByteArray::new);
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return userRepository.findByWebauthnUserHandle(userHandle.getBytes()).map(u -> u.getUsername());
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return passkeyRepository.findByCredentialId(credentialId.getBytes())
                .filter(p -> userHandle.equals(handleOf(p)))
                .map(JpaCredentialRepository::toRegistered);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return passkeyRepository.findByCredentialId(credentialId.getBytes())
                .map(JpaCredentialRepository::toRegistered)
                .map(Set::of)
                .orElse(Set.of());
    }

    private static ByteArray handleOf(UserPasskey p) {
        byte[] handle = p.getUser().getWebauthnUserHandle();
        return handle == null ? null : new ByteArray(handle);
    }

    private static RegisteredCredential toRegistered(UserPasskey p) {
        return RegisteredCredential.builder()
                .credentialId(new ByteArray(p.getCredentialId()))
                .userHandle(handleOf(p))
                .publicKeyCose(new ByteArray(p.getPublicKeyCose()))
                .signatureCount(p.getSignatureCount())
                .build();
    }
}

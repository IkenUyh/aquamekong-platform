package com.aquamekong.repository.user;

import com.aquamekong.entity.user.UserPasskey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserPasskeyRepository extends JpaRepository<UserPasskey, Long> {

    Optional<UserPasskey> findByCredentialId(byte[] credentialId);

    List<UserPasskey> findByUserIdOrderByCreatedAtAsc(Long userId);

    long countByUserId(Long userId);

    Optional<UserPasskey> findByIdAndUserId(Long id, Long userId);
}

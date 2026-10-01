package com.aquamekong.repository.user;

import com.aquamekong.entity.user.UserIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {

    Optional<UserIdentity> findByProviderAndProviderUserId(String provider, String providerUserId);

    List<UserIdentity> findByUserId(Long userId);

    boolean existsByUserIdAndProvider(Long userId, String provider);

    long countByUserId(Long userId);

    void deleteByUserIdAndProvider(Long userId, String provider);
}

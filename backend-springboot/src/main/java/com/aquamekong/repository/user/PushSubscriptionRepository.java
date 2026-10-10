package com.aquamekong.repository.user;

import com.aquamekong.entity.user.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUserId(Long userId);

    long countByUserId(Long userId);

    /** Thiết bị của các tài khoản có ít nhất một trong các vai trò (vd. ROLE_ADMIN) */
    @Query("""
        SELECT s FROM PushSubscription s
        WHERE s.user.id IN (SELECT ur.user.id FROM UserRole ur WHERE ur.role.name IN :roles)
        """)
    List<PushSubscription> findByUserRoleIn(@Param("roles") Collection<String> roles);

    /**
     * Người nhận cảnh báo đo được ở một trạm: Quản trị/Vận hành, tài khoản theo dõi trạm đó,
     * và tài khoản chưa theo dõi trạm nào (nhận mọi trạm như trước khi có tính năng theo dõi).
     */
    @Query("""
        SELECT s FROM PushSubscription s
        WHERE s.user.id IN (SELECT ur.user.id FROM UserRole ur WHERE ur.role.name IN :staffRoles)
           OR NOT EXISTS (SELECT w.id FROM StationWatch w WHERE w.user = s.user)
           OR EXISTS (SELECT w.id FROM StationWatch w WHERE w.user = s.user AND w.station.id = :stationId)
        """)
    List<PushSubscription> findAlertRecipients(@Param("stationId") Long stationId,
                                               @Param("staffRoles") Collection<String> staffRoles);
}

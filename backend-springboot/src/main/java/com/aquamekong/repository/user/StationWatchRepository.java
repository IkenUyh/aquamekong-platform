package com.aquamekong.repository.user;

import com.aquamekong.entity.user.StationWatch;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationWatchRepository extends JpaRepository<StationWatch, Long> {

    @EntityGraph(attributePaths = {"station", "fieldProfile"})
    List<StationWatch> findByUserIdOrderByCreatedAtAsc(Long userId);

    /** Theo dõi đặt tay của tài khoản ở trạm này (không tính theo dõi tạo từ hồ sơ ruộng) */
    Optional<StationWatch> findByUserIdAndStationIdAndFieldProfileIsNull(Long userId, Long stationId);

    Optional<StationWatch> findByFieldProfileId(Long fieldProfileId);

    long countByUserId(Long userId);

    /** Mọi theo dõi, kèm hồ sơ ruộng và giai đoạn cây để job đổi ngưỡng khi cây sang giai đoạn mới */
    @EntityGraph(attributePaths = {"station", "user", "fieldProfile.crop.stages"})
    List<StationWatch> findAllByOrderByStationIdAsc();
}

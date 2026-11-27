package com.aquamekong.repository.field;

import com.aquamekong.entity.field.FieldProfile;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FieldProfileRepository extends JpaRepository<FieldProfile, Long> {

    @EntityGraph(attributePaths = {"station", "crop"})
    List<FieldProfile> findByUserIdOrderByCreatedAtAsc(Long userId);

    Optional<FieldProfile> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}

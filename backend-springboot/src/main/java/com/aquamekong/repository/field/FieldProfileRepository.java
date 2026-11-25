package com.aquamekong.repository.field;

import com.aquamekong.entity.field.FieldProfile;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FieldProfileRepository extends JpaRepository<FieldProfile, Long> {

    /** Mọi ruộng trên server (dùng chung), kèm trạm, cây và người khai */
    @EntityGraph(attributePaths = {"station", "crop", "user"})
    List<FieldProfile> findAllByOrderByCreatedAtAsc();
}

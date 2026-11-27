package com.aquamekong.repository.crop;

import com.aquamekong.entity.crop.Crop;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CropRepository extends JpaRepository<Crop, Long> {

    @EntityGraph(attributePaths = "stages")
    List<Crop> findAllByOrderBySortOrderAsc();

    @EntityGraph(attributePaths = "stages")
    Optional<Crop> findByCode(String code);
}

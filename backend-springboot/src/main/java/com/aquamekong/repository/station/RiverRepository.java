package com.aquamekong.repository.station;

import com.aquamekong.entity.station.River;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RiverRepository extends JpaRepository<River, Long> {

    Optional<River> findByName(String name);

    boolean existsByName(String name);
}

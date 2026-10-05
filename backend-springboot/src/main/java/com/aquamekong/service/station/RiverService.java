package com.aquamekong.service.station;

import com.aquamekong.dto.station.RiverDto;
import com.aquamekong.entity.station.River;
import com.aquamekong.repository.station.RiverRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RiverService {

    private final RiverRepository riverRepository;

    @Transactional(readOnly = true)
    public List<RiverDto> getAllRivers() {
        return riverRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RiverDto getRiverById(Long id) {
        River river = riverRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("River not found: " + id));
        return toDto(river);
    }

    @Transactional
    public RiverDto createRiver(RiverDto dto) {
        if (riverRepository.existsByName(dto.getName())) {
            throw new IllegalArgumentException("River with name already exists: " + dto.getName());
        }

        River river = River.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .build();

        River saved = riverRepository.save(river);
        return toDto(saved);
    }

    @Transactional
    public RiverDto updateRiver(Long id, RiverDto dto) {
        River river = riverRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("River not found: " + id));

        if (dto.getName() != null) river.setName(dto.getName());
        if (dto.getDescription() != null) river.setDescription(dto.getDescription());

        River saved = riverRepository.save(river);
        return toDto(saved);
    }

    @Transactional
    public void deleteRiver(Long id) {
        if (!riverRepository.existsById(id)) {
            throw new EntityNotFoundException("River not found: " + id);
        }
        riverRepository.deleteById(id);
    }

    private RiverDto toDto(River river) {
        return RiverDto.builder()
                .id(river.getId())
                .name(river.getName())
                .description(river.getDescription())
                .createdAt(river.getCreatedAt())
                .updatedAt(river.getUpdatedAt())
                .build();
    }
}

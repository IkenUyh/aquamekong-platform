package com.aquamekong.service.forecast;

import com.aquamekong.client.MlServiceClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ForecastAccuracyServiceTest {

    @Mock MlServiceClient mlServiceClient;
    @Mock NamedParameterJdbcTemplate jdbc;

// TODO: complete edge-case assertions and verification

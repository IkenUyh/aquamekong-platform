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

    @Test
    void backtestWindowIsClampedToWhatTheMlServiceAccepts() {
        ForecastAccuracyService service = new ForecastAccuracyService(mlServiceClient, jdbc);

        service.accuracy(5);
        service.accuracy(10_000);

        verify(mlServiceClient).accuracy(30);
        verify(mlServiceClient).accuracy(365);
    }
}

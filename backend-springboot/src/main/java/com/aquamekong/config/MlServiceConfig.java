package com.aquamekong.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class MlServiceConfig {

    @Bean
    public RestClient mlRestClient(
            RestClient.Builder builder,
            @Value("${app.ml-service.base-url}") String baseUrl,
            @Value("${app.ml-service.connect-timeout:5s}") Duration connectTimeout,
            @Value("${app.ml-service.read-timeout:60s}") Duration readTimeout) {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(connectTimeout)
                .withReadTimeout(readTimeout);
        return builder
                .baseUrl(baseUrl)
                .requestFactory(ClientHttpRequestFactories.get(settings))
                .build();
    }
}

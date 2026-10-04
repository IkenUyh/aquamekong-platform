package com.aquamekong.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/** Luồng riêng, có giới hạn, để gửi thông báo đẩy (gọi mạng ra ngoài) mà không chặn MeasurementPoller. */
@Slf4j
@Configuration
@EnableAsync
public class PushConfig {

    @Bean(name = "pushExecutor")
    public Executor pushExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("push-");
        // Hàng đợi đầy (dịch vụ push treo lâu): bỏ thông báo, cảnh báo vẫn có trên web
        executor.setRejectedExecutionHandler((task, pool) -> log.warn("Hàng đợi thông báo đẩy đầy, bỏ qua một thông báo"));
        executor.initialize();
        return executor;
    }
}

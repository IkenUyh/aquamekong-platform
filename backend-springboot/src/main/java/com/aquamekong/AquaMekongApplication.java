package com.aquamekong;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AquaMekongApplication {

    public static void main(String[] args) {
        SpringApplication.run(AquaMekongApplication.class, args);
    }
}

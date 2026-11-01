package com.aquamekong.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final WebRequest request = new ServletWebRequest(new MockHttpServletRequest("GET", "/api/v1/telemetry/stream"));

    @Test
    void clientDisconnectWritesNoResponse() {
        // Heartbeat SSE gửi tới tab đã đóng: không trả JSON vào luồng text/event-stream
        assertThat(handler.handleGlobalException(new IOException("Broken pipe"), request)).isNull();
    }

    @Test
    void otherErrorsStayInternalServerError() {
        var response = handler.handleGlobalException(new IllegalStateException("boom"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("message", "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.");
    }
}

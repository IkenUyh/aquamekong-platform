package com.aquamekong.client;

import com.aquamekong.exception.InsufficientDataException;
import com.aquamekong.exception.MlServiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

class MlServiceClientTest {

    private MockRestServiceServer server;
    private MlServiceClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ml");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new MlServiceClient(builder.build());
    }

    private void predictAnswers422(String body) {
        server.expect(requestTo("http://ml/api/v1/predict"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY).contentType(MediaType.APPLICATION_JSON).body(body));
    }

    @Test
    void stationWithoutRecentReadingsIsInsufficientData() {
        predictAnswers422("{\"detail\":\"Trạm 34 không có số đo độ mặn trong 30 ngày qua\"}");

        assertThatThrownBy(() -> client.predict(34L, 7))
                .isInstanceOf(InsufficientDataException.class)
                .hasMessage("Trạm 34 không có số đo độ mặn trong 30 ngày qua");
    }

    @Test
    void malformedRequestStaysAnMlServiceError() {
        // 422 của FastAPI khi body sai định dạng: detail là danh sách lỗi
        predictAnswers422("{\"detail\":[{\"loc\":[\"body\",\"station_id\"],\"msg\":\"field required\"}]}");

        assertThatThrownBy(() -> client.predict(34L, 7))
                .isInstanceOf(MlServiceException.class)
                .isNotInstanceOf(InsufficientDataException.class);
    }
}

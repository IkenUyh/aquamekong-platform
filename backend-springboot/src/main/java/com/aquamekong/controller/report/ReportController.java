package com.aquamekong.controller.report;

import com.aquamekong.dto.report.ReportDtos.Overview;
import com.aquamekong.dto.report.ReportDtos.TopStation;
import com.aquamekong.dto.report.ReportDtos.TrendPoint;
import com.aquamekong.service.report.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Báo cáo tổng hợp độ mặn, mực nước, lưu lượng")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/overview")
    @Operation(summary = "Chỉ số tổng hợp kỳ hiện tại so với kỳ trước", description = "days: 1-90 (mặc định 7)")
    public ResponseEntity<Overview> overview(@RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(reportService.overview(days));
    }

    @GetMapping("/trend")
    @Operation(summary = "Độ mặn trung bình toàn vùng theo ngày", description = "Mỗi điểm kèm giá trị cùng vị trí ở kỳ trước")
    public ResponseEntity<List<TrendPoint>> trend(@RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(reportService.salinityTrend(days));
    }

    @GetMapping("/top-stations")
    @Operation(summary = "Các trạm có độ mặn trung bình cao nhất trong kỳ")
    public ResponseEntity<List<TopStation>> topStations(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(reportService.topStations(days, limit));
    }
}

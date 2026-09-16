# Trạng thái Tích hợp Frontend & Backend

Tài liệu này tổng hợp các tính năng hiện có trên Frontend, trạng thái kết nối với Backend, và những API endpoints nào còn đang thiếu cần được phát triển thêm.

## Tóm tắt chung
Tất cả các tính năng có gọi API ở Frontend đều đã được bọc bởi cơ chế **Hybrid Fallback** tích hợp với **Redux**. Nghĩa là nếu backend chưa có endpoint hoặc server bị tắt/lỗi, Frontend sẽ tự động chuyển sang trạng thái "Offline Mode" (hiển thị trên Navbar) và sử dụng Mock Data để đảm bảo trải nghiệm người dùng không bị gián đoạn.

## Chi tiết các tính năng và API

### 1. Quản lý Trạm Quan Trắc (Stations)
- **Tính năng:** Bản đồ vị trí trạm (`/map`), Danh sách trạm (`/stations`), Tìm trạm lân cận.
- **Trạng thái:** 🟢 Đã liên kết Backend.
- **Endpoints đang sử dụng:**
  - `GET /api/v1/stations` (stationApi.getAll / getAllList)
  - `GET /api/v1/stations/{id}` (stationApi.getById)
  - `GET /api/v1/stations/nearby` (stationApi.getNearby)

### 2. Chỉ số Nước (Water Metrics)
- **Tính năng:** Hiển thị độ mặn, mực nước hiện tại và lịch sử trên biểu đồ.
- **Trạng thái:** 🟢 Đã liên kết Backend.
- **Endpoints đang sử dụng:**
  - `GET /api/v1/metrics/latest` (metricApi.getLatest)
  - `GET /api/v1/metrics/station/{stationId}` (metricApi.getByStation)

### 3. Dự báo Độ Mặn (Forecast)
- **Tính năng:** Trang dự báo chi tiết (`/forecast`), Biểu đồ xu hướng trong 7 ngày tới.
- **Trạng thái:** 🟢 Đã liên kết Backend (nhưng biểu đồ chi tiết trên trang Forecast hiện tại đang dùng hàm sinh dữ liệu tự động ở client do thiếu API trả về mảng dữ liệu chart đồng bộ).
- **Endpoints đang sử dụng:**
  - `POST /api/v1/forecasts/predict`
  - `GET /api/v1/forecasts/station/{stationId}`

### 4. Cảnh báo (Alerts)
- **Tính năng:** Trang quản lý cảnh báo (`/alerts`), hiển thị số lượng cảnh báo nguy hiểm.
- **Trạng thái:** 🟢 Đã liên kết Backend.
- **Endpoints đang sử dụng:**
  - `GET /api/v1/alerts` (alertApi.getRecent)
  - `GET /api/v1/alerts/unresolved` (alertApi.getUnresolved)
  - `GET /api/v1/alerts/count` (alertApi.getCount)

### 5. Khuyến nghị AI (Recommendations)
- **Tính năng:** Bảng điều khiển đưa ra các khuyến nghị ứng phó xâm nhập mặn.
- **Trạng thái:** 🟢 Đã liên kết Backend.
- **Endpoints đang sử dụng:**
  - `GET /api/v1/recommendations` (recommendationApi.getRecommendations)

### 6. Báo cáo & Thống kê (Reports)
- **Tính năng:** Trang báo cáo tổng quan (`/reports`), biểu đồ xu hướng toàn vùng, bảng xếp hạng các trạm có độ mặn cao nhất.
- **Trạng thái:** 🔴 **Chưa có API ở Backend**. Hiện tại đang chạy hoàn toàn bằng Fallback (Mock Data).
- **Endpoints CẦN BỔ SUNG:**
  - `GET /api/v1/reports/trend` (Trả về dữ liệu xu hướng mặn trung bình của vùng theo thời gian)
  - `GET /api/v1/reports/top-stations` (Trả về danh sách Top 5 trạm có độ mặn cao nhất)

---

> **Lưu ý dành cho Backend Developer:**
> Bạn cần tạo thêm một `ReportController.java` để cung cấp 2 endpoint bị thiếu ở phần 6. Frontend hiện đã khai báo sẵn `reportApi.ts`, ngay khi backend có endpoint, Frontend sẽ tự động fetch được dữ liệu thật mà không cần sửa code thêm.

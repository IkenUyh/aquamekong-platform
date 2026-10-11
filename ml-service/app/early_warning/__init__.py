"""
Mô hình rủi ro mặn (cảnh báo sớm).

Dự báo giữ nguyên số đo mới nhất có sai số trung bình thấp nhất, nhưng không bao giờ báo trước được lần độ mặn
bắt đầu vượt ngưỡng. Mô hình này học phân vị 20% và 80% của độ mặn 1..16 ngày tới (gradient boosting, thang log,
học phần thay đổi so với số mới nhất). Phân vị 80% là mức "có thể lên tới": vượt ngưỡng của người dùng thì báo sớm.

- features.py: đặc trưng, chỉ dùng số đo tới hết ngày trước ngày phát hành
- model.py: hai mô hình phân vị
- episodes.py: mô phỏng cách app báo người theo dõi trạm, để chấm "báo trước được bao nhiêu lần"
- service.py: huấn luyện lại khi có số đo mới, chạy lại trên từng mùa khô cũ, dự báo thật
"""

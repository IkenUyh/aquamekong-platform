import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiScaleTCN(nn.Module):
    def __init__(self, in_channels, out_channels):
        super(MultiScaleTCN, self).__init__()
        c1 = out_channels // 2
        c2 = out_channels - c1
        
        # Nhánh 1: Tích chập nhìn gần (Kernel 3)
        self.conv1 = nn.Conv2d(in_channels, c1, kernel_size=(1, 3), padding=(0, 1))
        # Nhánh 2: Tích chập giãn cách (Dilation = 2) nhìn xa hơn về quá khứ mà không tăng tham số
        self.conv2 = nn.Conv2d(in_channels, c2, kernel_size=(1, 3), padding=(0, 2), dilation=(1, 2))
        
        # Cổng Gated Activation (Học từ kiến trúc LSTM)
        self.gate_conv = nn.Conv2d(in_channels, out_channels, kernel_size=(1, 1))
        
        # Lớp chuẩn hóa LayerNorm: Vũ khí cực mạnh chống Overfitting
        self.norm = nn.LayerNorm(out_channels)

    def forward(self, x):
        # x: (Batch, Channels, N, Lookback)
        b1 = self.conv1(x)
        b2 = self.conv2(x)
        
        # Inception: Nối các đặc trưng đa tỷ lệ lại với nhau
        out = torch.cat([b1, b2], dim=1) 
        
        # Gating Mechanism
        gate = torch.sigmoid(self.gate_conv(x))
        out = torch.tanh(out) * gate
        
        # Layer Normalization
        out = out.permute(0, 2, 3, 1) # (B, N, L, Channels)
        out = self.norm(out)
        out = out.permute(0, 3, 1, 2) # (B, Channels, N, L)
        
        return out

class SpatialAttention(nn.Module):
    def __init__(self, hidden_dim):
        super(SpatialAttention, self).__init__()
        self.W1 = nn.Parameter(torch.randn(hidden_dim, hidden_dim))
        self.W2 = nn.Parameter(torch.randn(hidden_dim, hidden_dim))
        self.b = nn.Parameter(torch.zeros(1))
        self.V = nn.Parameter(torch.randn(hidden_dim, 1))
        
        # Initialize parameters for stability
        nn.init.xavier_uniform_(self.W1)
        nn.init.xavier_uniform_(self.W2)
        nn.init.xavier_uniform_(self.V)

    def forward(self, x, W_D):
        # x: (Batch, Lookback, N, Hidden)
        B, L, N, H = x.shape
        
        # Tính toán ma trận Attention động dựa trên tính năng trung bình của từng trạm
        x_mean = x.mean(dim=1) # (B, N, H)
        
        left = torch.matmul(x_mean, self.W1).unsqueeze(2)  # (B, N, 1, H)
        right = torch.matmul(x_mean, self.W2).unsqueeze(1) # (B, 1, N, H)
        
        score = torch.matmul(F.relu(left + right + self.b), self.V).squeeze(-1) # (B, N, N)
        
        # Kết hợp Không gian vật lý (W_D) và Sự chú ý động (Attention)
        W_D = W_D.unsqueeze(0) # (1, N, N)
        adj = F.softmax(score, dim=-1) * W_D
        
        # Tích chập đồ thị với Ma trận kề động (Dynamic Adjacency)
        x_flat = x.contiguous().view(B*L, N, H)
        adj_expanded = adj.unsqueeze(1).expand(B, L, N, N).contiguous().view(B*L, N, N)
        
        out_flat = torch.bmm(adj_expanded, x_flat)
        out = out_flat.view(B, L, N, H)
        
        return F.relu(out)

class STGNN(nn.Module):
    def __init__(self, num_stations, num_features, lookback, d=8, horizon=1):
        """
        Phiên bản ST-GNN Cao cấp: Multi-scale TCN + Graph Attention + LayerNorm
        """
        super(STGNN, self).__init__()
        self.num_stations = num_stations
        self.lookback = lookback
        self.horizon = horizon
        self.hidden_dim = 16 # Vẫn giữ nguyên chiều nhỏ gọn để tránh Overfit
        
        self.input_fc = nn.Linear(num_features, self.hidden_dim)
        
        # Khối TCN Đa tỷ lệ thứ 1
        self.tcn1 = MultiScaleTCN(self.hidden_dim, self.hidden_dim)
        
        # Khối Đồ thị Không gian - Chú ý động (Graph Attention)
        self.gat = SpatialAttention(self.hidden_dim)
        self.gat_norm = nn.LayerNorm(self.hidden_dim)
        
        # Khối TCN Đa tỷ lệ thứ 2
        self.tcn2 = MultiScaleTCN(self.hidden_dim, self.hidden_dim)
        
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(self.hidden_dim * lookback, 3) # Xuất ra 3 mức: Q10, Q50, Q90

    def forward(self, x, W_D):
        batch_size = x.shape[0]
        
        x = self.input_fc(x)
        residual = x # Global Residual Connection
        
        # 1. Trích xuất đặc trưng thời gian (TCN Đa tỷ lệ)
        x = x.permute(0, 3, 1, 2) 
        x = self.tcn1(x)
        x = self.dropout(x)
        
        # 2. Phân tán đặc trưng qua Không gian (Graph Attention)
        x = x.permute(0, 3, 2, 1) 
        gat_out = self.gat(x, W_D)
        gat_out = self.dropout(gat_out)
        x = self.gat_norm(x + gat_out) # Local Residual + LayerNorm
        
        # 3. Trích xuất thời gian lần 2
        x = x.permute(0, 3, 2, 1)
        x = self.tcn2(x)
        x = self.dropout(x)
        
        # 4. Trả về định dạng ban đầu
        x = x.permute(0, 2, 3, 1) 
        
        # 5. Global Residual (Đường tắt bảo vệ khỏi Overfitting)
        x = x + residual
        
        x = x.reshape(batch_size, self.num_stations, -1)
        out = self.fc(x) # [Batch, Stations, 3]
        
        return out

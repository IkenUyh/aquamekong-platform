import torch
import torch.nn as nn
import torch.nn.functional as F

class GraphConv(nn.Module):
    def __init__(self, in_features, out_features):
        super(GraphConv, self).__init__()
        self.weight = nn.Parameter(torch.FloatTensor(in_features, out_features))
        self.bias = nn.Parameter(torch.FloatTensor(out_features))
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.xavier_uniform_(self.weight)
        nn.init.zeros_(self.bias)

    def forward(self, x, adj):
        # x shape: (Batch, Lookback, N, in_features)
        # adj shape: (N, N)
        # We want to multiply adjacent nodes' features.
        
        # x: (B, L, N, in_features) -> x @ weight -> (B, L, N, out_features)
        support = torch.matmul(x, self.weight)
        
        # Multiply by adjacency matrix along the N dimension
        # support shape: (B, L, N, out_features)
        # adj shape: (N, N)
        # result: (B, L, N, out_features)
        # We do einsum: b=batch, l=lookback, n=node_out, m=node_in, f=feature
        out = torch.einsum('blmf,nm->blnf', support, adj)
        return out + self.bias

class STGNN(nn.Module):
    def __init__(self, num_stations, num_features, lookback, d=8):
        super(STGNN, self).__init__()
        self.num_stations = num_stations
        self.lookback = lookback
        
        # Adaptive Graph Embeddings (E1 and E2)
        self.E1 = nn.Parameter(torch.randn(num_stations, d))
        self.E2 = nn.Parameter(torch.randn(num_stations, d))
        
        # TCN 1: Temporal convolution
        self.tcn1 = nn.Conv2d(in_channels=num_features, out_channels=32, kernel_size=(1, 3))
        
        # GCN 1: Spatial convolution
        self.gcn1 = GraphConv(32, 32)
        
        # TCN 2: Temporal convolution
        self.tcn2 = nn.Conv2d(in_channels=32, out_channels=64, kernel_size=(1, 3))
        
        # Final output layer
        # After 2 TCNs (kernel 3, no padding), lookback length decreases by 4
        final_lookback = lookback - 4
        self.fc = nn.Linear(64 * final_lookback, 1)

    def compute_adjacency(self, W_D):
        """
        Compute W = W_D ⊙ Softmax(ReLU(E1 * E2^T))
        W_D: Physical distance matrix (N, N)
        """
        # E1 * E2^T
        adaptive_matrix = torch.matmul(self.E1, self.E2.transpose(0, 1))
        # ReLU and Softmax
        W_A = F.softmax(F.relu(adaptive_matrix), dim=1)
        
        # Hadamard product
        W = W_D * W_A
        return W

    def forward(self, x, W_D):
        """
        x shape: (Batch, N, Lookback, Features)
        W_D shape: (N, N)
        """
        batch_size = x.shape[0]
        
        # Compute dynamic adjacency
        adj = self.compute_adjacency(W_D)
        
        # --- TCN 1 ---
        # For Conv2d, shape needs to be (Batch, Channels, N, Lookback)
        # x is currently (Batch, N, Lookback, Channels)
        x = x.permute(0, 3, 1, 2)
        x = F.relu(self.tcn1(x))
        
        # --- GCN 1 ---
        # GraphConv expects (Batch, Lookback, N, Channels)
        x = x.permute(0, 3, 2, 1)
        x = F.relu(self.gcn1(x, adj))
        
        # --- TCN 2 ---
        # Convert back to (Batch, Channels, N, Lookback) for Conv2d
        x = x.permute(0, 3, 2, 1)
        x = F.relu(self.tcn2(x))
        
        # --- FC Layer ---
        # Flatten the temporal and channel dimensions for each station
        # x is (Batch, Channels, N, Lookback) -> (Batch, N, Channels * Lookback)
        x = x.permute(0, 2, 1, 3).reshape(batch_size, self.num_stations, -1)
        
        # Predict 1 step ahead for each station
        # out shape: (Batch, N, 1)
        out = self.fc(x)
        
        # Remove the last dimension: (Batch, N)
        return out.squeeze(-1)

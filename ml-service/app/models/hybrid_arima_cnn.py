import torch
import torch.nn as nn

class ResidualCNN(nn.Module):
    """
    1D-CNN Model to learn the residuals (errors) from the ARIMA model.
    """
    def __init__(self, input_size=4, hidden_channels=32, output_size=1, dropout=0.2):
        super(ResidualCNN, self).__init__()
        # Input shape expected: (batch_size, input_size, seq_len)
        self.conv1 = nn.Conv1d(in_channels=input_size, out_channels=hidden_channels, kernel_size=3, padding=1)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        
        # Adaptive pooling to handle any sequence length
        self.pool = nn.AdaptiveAvgPool1d(1)
        
        # Fully connected layers to output a single prediction value
        self.fc = nn.Sequential(
            nn.Linear(hidden_channels, 16),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(16, output_size)
        )

    def forward(self, x):
        # x comes in as (batch_size, seq_len, input_size)
        # Conv1d expects (batch_size, input_size, seq_len)
        x = x.transpose(1, 2)
        
        x = self.conv1(x)
        x = self.relu(x)
        x = self.dropout(x)
        
        # Pool across the sequence dimension
        x = self.pool(x)  # shape: (batch_size, hidden_channels, 1)
        x = x.squeeze(-1) # shape: (batch_size, hidden_channels)
        
        # Final linear prediction
        out = self.fc(x)
        return out

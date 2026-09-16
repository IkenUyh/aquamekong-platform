import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NetworkState {
  isOfflineMode: boolean;
}

const initialState: NetworkState = {
  isOfflineMode: false,
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOfflineMode = action.payload;
    },
  },
});

export const { setOfflineMode } = networkSlice.actions;

export default networkSlice.reducer;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lỗi 4xx (401, 403, 404...) thử lại cũng vô ích
      retry: (failureCount, error) =>
        !(isAxiosError(error) && (error.response?.status ?? 0) >= 400 && (error.response?.status ?? 0) < 500) &&
        failureCount < 2,
      refetchOnWindowFocus: false,
      // Dữ liệu quan trắc cập nhật theo phút: tránh gọi lại API mỗi lần chuyển trang
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** 'true' để bật mock fallback ở bản build production (mặc định chỉ bật khi `npm run dev`) */
  readonly VITE_ENABLE_MOCK_FALLBACK?: string;
}

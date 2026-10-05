import React from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

/** Màn hình lỗi cho route: một trang lỗi không làm trắng cả ứng dụng. */
export function RouteError({ notFound: forceNotFound = false }: { notFound?: boolean }) {
  const error = useRouteError();
  const notFound = forceNotFound || (isRouteErrorResponse(error) && error.status === 404);
  if (!notFound) console.error(error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full card p-8 text-center space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">
          {notFound ? 'Không tìm thấy trang' : 'Trang gặp sự cố khi hiển thị'}
        </h1>
        <p className="text-sm text-gray-500">
          {notFound ? 'Đường dẫn không tồn tại.' : 'Bạn thử tải lại trang. Nếu vẫn lỗi, vui lòng báo cho quản trị viên.'}
        </p>
        <div className="flex gap-2 justify-center">
          {!notFound && (
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-700 text-white text-sm font-medium">
              Tải lại trang
            </button>
          )}
          <Link to="/" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            Về trang Tổng quan
          </Link>
        </div>
      </div>
    </div>
  );
}

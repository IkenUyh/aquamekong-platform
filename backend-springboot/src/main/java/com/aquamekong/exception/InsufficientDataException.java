package com.aquamekong.exception;

/**
 * ML service từ chối dự báo vì trạm không đủ số đo gần đây (trạm mất tín hiệu, trạm mới lắp). Không phải lỗi hệ
 * thống: ml-service cố ý không bịa số cho trạm này.
 */
public class InsufficientDataException extends MlServiceException {

    public InsufficientDataException(String message, Throwable cause) {
        super(message, cause);
    }
}

package com.aquamekong.service.push;

/**
 * Nội dung một thông báo.
 *
 * @param url đường dẫn trong app mở ra khi bấm vào thông báo (vd. /alerts)
 * @param tag thông báo cùng tag thay thế nhau trên máy, không xếp chồng
 */
public record PushMessage(String title, String body, String url, String tag) {
}

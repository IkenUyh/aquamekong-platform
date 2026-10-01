package com.aquamekong.service.auth;

import com.aquamekong.entity.user.User;
import com.aquamekong.repository.user.UserIdentityRepository;
import com.aquamekong.repository.user.UserPasskeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Không cho user gỡ cách đăng nhập cuối cùng (mật khẩu, Google/Zalo, passkey). */
@Component
@RequiredArgsConstructor
public class LoginMethodGuard {

    private final UserIdentityRepository identityRepository;
    private final UserPasskeyRepository passkeyRepository;

    /** Gọi trước khi gỡ đúng 1 cách đăng nhập */
    public void requireAnotherMethod(User user) {
        long methods = (user.getPasswordHash() != null ? 1 : 0)
                + identityRepository.countByUserId(user.getId())
                + passkeyRepository.countByUserId(user.getId());
        if (methods <= 1) {
            throw new IllegalArgumentException("Đây là cách đăng nhập duy nhất của bạn. Hãy đặt mật khẩu hoặc thêm cách đăng nhập khác trước khi gỡ.");
        }
    }
}

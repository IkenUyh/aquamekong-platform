package com.aquamekong.controller.user;

import com.aquamekong.dto.user.UserDto;
import com.aquamekong.entity.enums.UserStatus;
import com.aquamekong.service.user.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Quản lý tài khoản người dùng và phân quyền hệ thống")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "Danh sách người dùng")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết người dùng theo ID")
    public ResponseEntity<UserDto> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping("/username/{username}")
    @Operation(summary = "Chi tiết người dùng theo username")
    public ResponseEntity<UserDto> getUserByUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.getUserByUsername(username));
    }

    @PostMapping
    @Operation(summary = "Tạo người dùng mới")
    public ResponseEntity<UserDto> createUser(@RequestBody UserDto dto, @RequestParam String password) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(dto, password));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Cập nhật trạng thái người dùng (ACTIVE, INACTIVE, SUSPENDED)")
    public ResponseEntity<UserDto> updateUserStatus(@PathVariable Long id, @RequestParam UserStatus status) {
        return ResponseEntity.ok(userService.updateUserStatus(id, status));
    }

    @PostMapping("/{id}/roles")
    @Operation(summary = "Gán vai trò (role) cho người dùng")
    public ResponseEntity<Void> assignRoleToUser(@PathVariable Long id, @RequestParam String roleName) {
        userService.assignRoleToUser(id, roleName);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/roles")
    @Operation(summary = "Gỡ vai trò (role) khỏi người dùng")
    public ResponseEntity<Void> removeRoleFromUser(@PathVariable Long id, @RequestParam String roleName) {
        userService.removeRoleFromUser(id, roleName);
        return ResponseEntity.noContent().build();
    }
}

package com.hk.ordersservice.mapper;

import com.hk.ordersservice.dto.UserResponse;
import com.hk.ordersservice.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
    
    public UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .address(user.getAddress())
                .createdAt(user.getCreatedAt())
                .build();
    }
}

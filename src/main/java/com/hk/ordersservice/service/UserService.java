package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.UserCreateRequest;
import com.hk.ordersservice.dto.UserResponse;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {
    
    private final UserRepository userRepository; // don't need to create the object as Spring will do it for us
    
    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("User with email " + request.getEmail() + " already exists");
        }
        
        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .address(request.getAddress())
                .build();
        
        User savedUser = userRepository.save(user);
        
        return UserResponse.builder()
                .userId(savedUser.getId())
                .name(savedUser.getName())
                .email(savedUser.getEmail())
                .address(savedUser.getAddress())
                .createdAt(savedUser.getCreatedAt())
                .build();
    }
    
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(user -> UserResponse.builder()
                        .userId(user.getId())
                        .name(user.getName())
                        .email(user.getEmail())
                        .address(user.getAddress())
                        .createdAt(user.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}

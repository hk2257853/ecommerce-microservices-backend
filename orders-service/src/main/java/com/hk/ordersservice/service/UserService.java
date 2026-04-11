package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.UserCreateRequest;
import com.hk.ordersservice.dto.UserResponse;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.exception.DuplicateResourceException;
import com.hk.ordersservice.mapper.UserMapper;
import com.hk.ordersservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {
    
    private final UserRepository userRepository; // don't need to create the object as Spring will do it for us
    private final UserMapper userMapper;
    
    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User", "email", request.getEmail());
        }
        
        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .address(request.getAddress())
                .build();
        
        User savedUser = userRepository.save(user);
        
        return userMapper.toUserResponse(savedUser);
    }
    
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(userMapper::toUserResponse)
                .collect(Collectors.toList());
    }
}

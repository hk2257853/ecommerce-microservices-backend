package com.hk.ordersservice.service;

import com.hk.ordersservice.dto.UserCreateRequest;
import com.hk.ordersservice.dto.UserResponse;
import com.hk.ordersservice.entity.User;
import com.hk.ordersservice.exception.DuplicateResourceException;
import com.hk.ordersservice.mapper.UserMapper;
import com.hk.ordersservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserService userService;

    private UserCreateRequest userCreateRequest;
    private User testUser;
    private UserResponse userResponse;

    @BeforeEach
    void setUp() {
        // Create test user create request
        userCreateRequest = UserCreateRequest.builder()
                .name("Test User")
                .email("test@example.com")
                .address("123 Test St")
                .build();

        // Create test user entity
        testUser = User.builder()
                .id(1L)
                .name("Test User")
                .email("test@example.com")
                .address("123 Test St")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Create test user response
        userResponse = UserResponse.builder()
                .userId(1L)
                .name("Test User")
                .email("test@example.com")
                .address("123 Test St")
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void testCreateUserSuccess() {
        // Arrange
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(userMapper.toUserResponse(testUser)).thenReturn(userResponse);

        // Act
        UserResponse result = userService.createUser(userCreateRequest);

        // Assert
        assertNotNull(result);
        assertEquals(userResponse.getUserId(), result.getUserId());
        assertEquals(userResponse.getName(), result.getName());
        assertEquals(userResponse.getEmail(), result.getEmail());
        assertEquals(userResponse.getAddress(), result.getAddress());

        // Verify interactions
        verify(userRepository).existsByEmail("test@example.com");
        verify(userRepository).save(any(User.class));
        verify(userMapper).toUserResponse(testUser);
    }

    @Test
    void testCreateUserDuplicateEmail() {
        // Arrange
        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        // Act & Assert
        DuplicateResourceException exception = assertThrows(
                DuplicateResourceException.class,
                () -> userService.createUser(userCreateRequest)
        );

        assertTrue(exception.getMessage().contains("User"));
        assertTrue(exception.getMessage().contains("email"));
        assertTrue(exception.getMessage().contains("test@example.com"));

        // Verify interactions
        verify(userRepository).existsByEmail("test@example.com");
        verify(userRepository, never()).save(any());
        verify(userMapper, never()).toUserResponse(any());
    }

    @Test
    void testGetAllUsersSuccess() {
        // Arrange
        User testUser2 = User.builder()
                .id(2L)
                .name("Test User 2")
                .email("test2@example.com")
                .address("456 Test St")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        UserResponse userResponse2 = UserResponse.builder()
                .userId(2L)
                .name("Test User 2")
                .email("test2@example.com")
                .address("456 Test St")
                .createdAt(LocalDateTime.now())
                .build();

        List<User> users = Arrays.asList(testUser, testUser2);
        when(userRepository.findAll()).thenReturn(users);
        when(userMapper.toUserResponse(testUser)).thenReturn(userResponse);
        when(userMapper.toUserResponse(testUser2)).thenReturn(userResponse2);

        // Act
        List<UserResponse> result = userService.getAllUsers();

        // Assert
        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals(userResponse.getUserId(), result.get(0).getUserId());
        assertEquals(userResponse.getName(), result.get(0).getName());
        assertEquals(userResponse.getEmail(), result.get(0).getEmail());
        assertEquals(userResponse2.getUserId(), result.get(1).getUserId());
        assertEquals(userResponse2.getName(), result.get(1).getName());
        assertEquals(userResponse2.getEmail(), result.get(1).getEmail());

        // Verify interactions
        verify(userRepository).findAll();
        verify(userMapper).toUserResponse(testUser);
        verify(userMapper).toUserResponse(testUser2);
    }

    @Test
    void testGetAllUsersEmptyList() {
        // Arrange
        when(userRepository.findAll()).thenReturn(Arrays.asList());

        // Act
        List<UserResponse> result = userService.getAllUsers();

        // Assert
        assertNotNull(result);
        assertTrue(result.isEmpty());

        // Verify interactions
        verify(userRepository).findAll();
        verify(userMapper, never()).toUserResponse(any());
    }

}

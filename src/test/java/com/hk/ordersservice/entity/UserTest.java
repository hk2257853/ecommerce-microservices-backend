package com.hk.ordersservice.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

// This is a test class for the User entity
class UserTest {

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .name("Test User")
                .email("test@example.com")
                .address("123 Test St, Test City")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    void testPrePersistSetsTimestamps() {
        User newUser = new User();
        newUser.setName("New User");
        newUser.setEmail("newuser@example.com");
        newUser.setAddress("456 New St");
        
        // Simulate @PrePersist
        newUser.onCreate();
        
        assertNotNull(newUser.getCreatedAt());
        assertNotNull(newUser.getUpdatedAt());
    }

    @Test
    void testPreUpdateUpdatesTimestamp() {
        LocalDateTime originalUpdatedAt = user.getUpdatedAt();
        
        // Wait a bit to ensure different timestamp
        try {
            Thread.sleep(1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Simulate @PreUpdate
        user.onUpdate();
        
        assertTrue(user.getUpdatedAt().isAfter(originalUpdatedAt));
    }
}

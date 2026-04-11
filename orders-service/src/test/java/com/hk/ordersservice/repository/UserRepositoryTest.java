package com.hk.ordersservice.repository;

import com.hk.ordersservice.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    private User testUser1;
    private User testUser2;

    @BeforeEach
    void setUp() {
        // Create and persist test users
        testUser1 = User.builder()
                .name("Test User One")
                .email("test1@example.com")
                .address("123 Test St")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        testUser2 = User.builder()
                .name("Test User Two")
                .email("test2@example.com")
                .address("456 Test Ave")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        testUser1 = entityManager.persistAndFlush(testUser1);
        testUser2 = entityManager.persistAndFlush(testUser2);

        entityManager.clear();
    }

    @Test
    void testFindByEmail() {
        Optional<User> foundUser = userRepository.findByEmail("test1@example.com");

        assertTrue(foundUser.isPresent());
        assertEquals(testUser1.getId(), foundUser.get().getId());
        assertEquals(testUser1.getEmail(), foundUser.get().getEmail());
    }

    @Test
    void testFindByEmailNotFound() {
        Optional<User> foundUser = userRepository.findByEmail("nonexistent@example.com");

        assertFalse(foundUser.isPresent());
    }

    @Test
    void testExistsByEmail() {
        assertTrue(userRepository.existsByEmail("test1@example.com"));
        assertTrue(userRepository.existsByEmail("test2@example.com"));
        assertFalse(userRepository.existsByEmail("nonexistent@example.com"));
    }
}

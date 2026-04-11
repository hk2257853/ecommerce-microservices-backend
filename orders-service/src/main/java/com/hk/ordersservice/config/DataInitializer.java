package com.hk.ordersservice.config;

import com.github.javafaker.Faker;
import com.hk.ordersservice.entity.Product;
import com.hk.ordersservice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Random;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final ProductRepository productRepository;
    private final Random random = new Random();

    @Override
    public void run(ApplicationArguments args) {
        if (productRepository.count() >= 100)
            return; // skip if data already exists

        Faker faker = new Faker();

        for (int i = 0; i < 100; i++) {
            Product product = Product.builder()
                    .name(faker.commerce().productName())
                    .unitPrice(new BigDecimal(faker.commerce().price())
                            .setScale(2, RoundingMode.HALF_UP))
                    .quantity(random.nextInt(50) + 1) // Random quantity between 1-50
                    .build();
            productRepository.save(product);
        }

        System.out.println("Seeded 100 products successfully.");
    }
}
package com.hk.ordersservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("Orders Service is running successfully!");
    }

    @GetMapping("/status")
    public ResponseEntity<Object> getStatus() {
        return ResponseEntity.ok(new TestResponse(
            "Orders Service",
            "ACTIVE",
            System.currentTimeMillis()
        ));
    }

    private record TestResponse(String service, String status, long timestamp) {}
}

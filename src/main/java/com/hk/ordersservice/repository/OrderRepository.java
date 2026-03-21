package com.hk.ordersservice.repository;

import com.hk.ordersservice.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    
    Optional<Order> findByOrderNumber(String orderNumber);
    
    List<Order> findByCustomerEmail(String customerEmail);
    
    List<Order> findByStatus(com.hk.ordersservice.entity.OrderStatus status);
    
    @Query("SELECT o FROM Order o WHERE o.customerName LIKE %:customerName%")
    List<Order> findByCustomerNameContaining(@Param("customerName") String customerName);
    
    @Query("SELECT o FROM Order o WHERE o.productName LIKE %:productName%")
    List<Order> findByProductNameContaining(@Param("productName") String productName);
}

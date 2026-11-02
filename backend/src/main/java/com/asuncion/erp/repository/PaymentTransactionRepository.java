package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByTransactionId(String transactionId);

    Optional<PaymentTransaction> findByCipCode(String cipCode);

    List<PaymentTransaction> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    Optional<PaymentTransaction> findFirstByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<PaymentTransaction> findTop50ByOrderByCreatedAtDesc();
}

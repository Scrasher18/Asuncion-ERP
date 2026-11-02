package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.CustomerOrder;
import com.asuncion.erp.domain.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {

    Optional<CustomerOrder> findByOrderNumberIgnoreCase(String orderNumber);

    List<CustomerOrder> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    List<CustomerOrder> findAllByOrderByCreatedAtDesc();

    List<CustomerOrder> findByStatusOrderByCreatedAtDesc(OrderStatus status);

    List<CustomerOrder> findByStatusInOrderByCreatedAtAsc(Collection<OrderStatus> statuses);

    List<CustomerOrder> findByStatusInOrderByCreatedAtDesc(Collection<OrderStatus> statuses);

    List<CustomerOrder> findByCreatedAtAfterOrderByCreatedAtDesc(Instant since);

    long countByStatusIn(Collection<OrderStatus> statuses);
}

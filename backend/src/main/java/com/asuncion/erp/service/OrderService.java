package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.*;
import com.asuncion.erp.domain.enums.OrderStatus;
import com.asuncion.erp.domain.enums.RoleName;
import com.asuncion.erp.dto.logistics.CoverageValidationResponse;
import com.asuncion.erp.dto.order.*;
import com.asuncion.erp.exception.BadRequestException;
import com.asuncion.erp.exception.OutOfCoverageException;
import com.asuncion.erp.exception.ResourceNotFoundException;
import com.asuncion.erp.repository.BranchRepository;
import com.asuncion.erp.repository.CustomerOrderRepository;
import com.asuncion.erp.repository.PartRepository;
import com.asuncion.erp.repository.UserRepository;
import com.asuncion.erp.service.storage.StorageService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.Year;
import java.util.*;

@Service
public class OrderService {

    private static final BigDecimal ONE_PLUS_IGV = new BigDecimal("1.18");
    private static final BigDecimal BOLETA_DNI_THRESHOLD = new BigDecimal("700.00");

    private final CustomerOrderRepository orderRepository;
    private final PartRepository partRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final GeospatialCoverageService geospatialCoverageService;
    private final CatalogService catalogService;
    private final ImageOptimizationService imageOptimizationService;
    private final StorageService storageService;
    private final EmailNotificationService emailNotificationService;
    private final StockReservationService stockReservationService;
    private final PromotionCatalogService promotionCatalogService;

    public OrderService(
            CustomerOrderRepository orderRepository,
            PartRepository partRepository,
            BranchRepository branchRepository,
            UserRepository userRepository,
            GeospatialCoverageService geospatialCoverageService,
            CatalogService catalogService,
            ImageOptimizationService imageOptimizationService,
            StorageService storageService,
            EmailNotificationService emailNotificationService,
            StockReservationService stockReservationService,
            PromotionCatalogService promotionCatalogService
    ) {
        this.orderRepository = orderRepository;
        this.partRepository = partRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.geospatialCoverageService = geospatialCoverageService;
        this.catalogService = catalogService;
        this.imageOptimizationService = imageOptimizationService;
        this.storageService = storageService;
        this.emailNotificationService = emailNotificationService;
        this.stockReservationService = stockReservationService;
        this.promotionCatalogService = promotionCatalogService;
    }

    @Transactional
    public OrderResponse createOrder(OrderCreateRequest req, AppUser currentUser) {
        String deliveryType = normalizeDeliveryType(req.deliveryType());

        Branch branch;
        BigDecimal deliveryFee;
        Double calculatedDistance = null;
        org.locationtech.jts.geom.Point deliveryPoint = null;

        if ("DELIVERY".equals(deliveryType)) {
            if (req.deliveryLatitude() == null || req.deliveryLongitude() == null) {
                throw new BadRequestException("Las coordenadas geográficas de entrega (deliveryLatitude, deliveryLongitude) son obligatorias para envíos a domicilio.");
            }

            // STRICT BACKEND GEOSPATIAL ENFORCEMENT (PostGIS ST_DWithin / JTS WGS84)
            CoverageValidationResponse coverage = geospatialCoverageService.validateCoverage(
                    req.deliveryLatitude(),
                    req.deliveryLongitude(),
                    req.branchId()
            );

            if (!coverage.covered()) {
                throw new OutOfCoverageException(
                        coverage.message(),
                        coverage.distanceMeters(),
                        coverage.allowedRadiusMeters()
                );
            }

            branch = branchRepository.findById(coverage.branchId())
                    .orElseThrow(() -> new ResourceNotFoundException("Sucursal no encontrada con ID: " + coverage.branchId()));
            deliveryFee = coverage.estimatedDeliveryFee();
            calculatedDistance = coverage.distanceMeters();
            deliveryPoint = geospatialCoverageService.createWgs84Point(req.deliveryLongitude(), req.deliveryLatitude());
        } else {
            branch = req.branchId() != null
                    ? branchRepository.findById(req.branchId())
                        .orElseThrow(() -> new ResourceNotFoundException("Sucursal no encontrada con ID: " + req.branchId()))
                    : branchRepository.findByActiveTrueOrderByIdAsc().stream()
                        .findFirst()
                        .orElseThrow(() -> new BadRequestException("No hay sucursales activas disponibles."));
            deliveryFee = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        // Consolidate duplicate partIds in request and sort by partId ASC to prevent DB lock deadlocks
        Map<Long, Integer> requestedQuantities = new TreeMap<>();
        for (OrderItemRequest itemReq : req.items()) {
            requestedQuantities.merge(itemReq.partId(), itemReq.quantity(), Integer::sum);
        }

        String rawDeliveryType = req.deliveryType() != null ? req.deliveryType().trim().toUpperCase() : "";
        boolean isCounterSale = rawDeliveryType.contains("MOSTRADOR") || rawDeliveryType.contains("PRESENCIAL")
                || (req.paymentMethod() != null && req.paymentMethod().trim().toUpperCase().startsWith("MOSTRADOR"));

        String paymentMethod = req.paymentMethod() != null && !req.paymentMethod().isBlank()
                ? req.paymentMethod().trim().toUpperCase()
                : "TARJETA";
        boolean isOnlinePayment = !isCounterSale && isOnlinePaymentMethod(paymentMethod);
        OrderStatus initialStatus = isCounterSale
                ? OrderStatus.ENTREGADO
                : (isOnlinePayment ? OrderStatus.PENDIENTE : OrderStatus.CONFIRMADO);

        CustomerOrder order = new CustomerOrder();
        order.setOrderNumber(generateNextOrderNumber());
        order.setCustomer(currentUser);
        order.setBranch(branch);
        order.setStatus(initialStatus);
        order.setDeliveryType(deliveryType);
        order.setDeliveryAddress(req.deliveryAddress() != null && !req.deliveryAddress().isBlank()
                ? req.deliveryAddress().trim()
                : (isCounterSale
                    ? "Venta presencial en mostrador: " + branch.getName()
                    : ("PICKUP".equals(deliveryType) ? "Recojo en tienda: " + branch.getName() : null)));
        order.setDeliveryReference(req.deliveryReference() != null ? req.deliveryReference().trim() : null);
        order.setDeliveryLocation(deliveryPoint);
        order.setCalculatedDistanceMeters(calculatedDistance);

        String taxId = firstNonBlank(req.billingDocumentNumber(), req.customerTaxId(), currentUser.getDocumentNumber());
        String invoiceType = normalizeInvoiceType(req.invoiceType(), taxId);
        order.setInvoiceType(invoiceType);
        order.setCustomerTaxId(taxId);
        order.setCustomerBusinessName(firstNonBlank(req.billingBusinessName(), req.customerBusinessName(), currentUser.getFullName()));
        order.setRecipientName(firstNonBlank(req.recipientName(), currentUser.getFullName()));
        order.setRecipientPhone(firstNonBlank(req.recipientPhone(), currentUser.getPhone()));
        order.setPaymentMethod(req.paymentMethod() != null && !req.paymentMethod().isBlank()
                ? req.paymentMethod().trim().toUpperCase()
                : "TARJETA");
        order.setNotes(req.notes() != null ? req.notes().trim() : null);

        // Generar PIN único de 4 dígitos de seguridad para entrega de pedidos delivery
        String securityPin = String.format(Locale.US, "%04d", java.util.concurrent.ThreadLocalRandom.current().nextInt(1000, 10000));
        order.setDeliverySecurityCode(securityPin);

        if (req.salespersonId() != null) {
            userRepository.findById(req.salespersonId()).ifPresent(order::setSalesperson);
        } else if (hasRole(currentUser, RoleName.VENDEDOR) || (isCounterSale && hasRole(currentUser, RoleName.ADMIN))) {
            order.setSalesperson(currentUser);
        }

        Map<Long, Part> lockedPartsById = new LinkedHashMap<>();
        for (Map.Entry<Long, Integer> entry : requestedQuantities.entrySet()) {
            // Acquire PESSIMISTIC_WRITE lock on Part row so two simultaneous checkouts cannot oversell stock
            Part part = partRepository.findByIdForUpdate(entry.getKey())
                    .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + entry.getKey()));
            int qty = entry.getValue();

            if (!part.isActive()) {
                throw new BadRequestException("El repuesto '" + part.getName() + "' (" + part.getSku() + ") no se encuentra disponible.");
            }

            // Physical counter sales (mostrador / caja) have immediate in-store dispensing priority
            // over uncommitted online cart holds. Online checkouts must respect other online holds.
            int reservedByOthers = isCounterSale
                    ? 0
                    : stockReservationService.getReservedQuantityExcludingSession(
                            part.getId(),
                            req.reservationSessionId()
                    );
            int effectiveAvailable = Math.max(0, part.getStockQuantity() - reservedByOthers);

            if (effectiveAvailable < qty) {
                if (reservedByOthers > 0 && part.getStockQuantity() >= qty) {
                    throw new BadRequestException(
                            String.format(
                                    "Stock en reserva para '%s' (%s): de las %d und. físicas en almacén, %d están en estado RESERVADO por otro cliente en proceso de pago (disponible ahora: %d, solicitado: %d).",
                                    part.getName(), part.getSku(), part.getStockQuantity(), reservedByOthers, effectiveAvailable, qty
                            )
                    );
                }
                throw new BadRequestException(
                        "Stock insuficiente para '" + part.getName() + "' (" + part.getSku() + "). Disponible: "
                                + effectiveAvailable + ", solicitado: " + qty
                );
            }

            part.setStockQuantity(part.getStockQuantity() - qty);
            partRepository.save(part);
            stockReservationService.reconcileHoldsForPart(part.getId(), part.getStockQuantity());
            lockedPartsById.put(part.getId(), part);
        }

        // Combos y ofertas promocionales son exclusivos de la web. En tienda física (POS) rige precio normal (o mayorista 4+).
        Map<Long, BigDecimal> effectiveUnitPrices;
        if (isCounterSale) {
            effectiveUnitPrices = new HashMap<>();
            for (Map.Entry<Long, Integer> entry : requestedQuantities.entrySet()) {
                Part part = lockedPartsById.get(entry.getKey());
                int qty = entry.getValue();
                BigDecimal price = part.getSalePrice();
                if (qty >= 4 && part.getWholesalePrice() != null
                        && part.getWholesalePrice().compareTo(BigDecimal.ZERO) > 0
                        && part.getWholesalePrice().compareTo(price) < 0) {
                    price = part.getWholesalePrice();
                }
                effectiveUnitPrices.put(part.getId(), price);
            }
        } else {
            effectiveUnitPrices = promotionCatalogService.resolveEffectiveUnitPricesAndTrackQuota(
                    lockedPartsById,
                    requestedQuantities,
                    req.customCombos()
            );
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (Map.Entry<Long, Integer> entry : requestedQuantities.entrySet()) {
            Part part = lockedPartsById.get(entry.getKey());
            int qty = entry.getValue();
            BigDecimal effectiveUnitPrice = effectiveUnitPrices.getOrDefault(part.getId(), part.getSalePrice());

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setPart(part);
            item.setQuantity(qty);
            item.setUnitPurchaseCost(part.getPurchasePrice());
            item.setUnitSalePrice(effectiveUnitPrice);
            item.setPicked(isCounterSale);
            order.getItems().add(item);

            BigDecimal lineSubtotal = effectiveUnitPrice.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineSubtotal);
        }

        // Catalog and POS retail prices already include 18% IGV per SUNAT Peru rules.
        BigDecimal grossItemsTotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        BigDecimal baseSubtotal = grossItemsTotal.divide(ONE_PLUS_IGV, 2, RoundingMode.HALF_UP);
        BigDecimal taxAmount = grossItemsTotal.subtract(baseSubtotal).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalAmount = grossItemsTotal.add(deliveryFee).setScale(2, RoundingMode.HALF_UP);

        order.setSubtotal(baseSubtotal);
        order.setTaxAmount(taxAmount);
        order.setDeliveryFee(deliveryFee);
        order.setTotalAmount(totalAmount);

        applySunatBillingRules(order, req, currentUser, isCounterSale, totalAmount);

        // Release temporary cart reservation only after stock & billing validations pass
        stockReservationService.releaseSession(req.reservationSessionId());

        String historyComment = isCounterSale
                ? "Venta presencial en mostrador (" + branch.getName() + "). Stock descontado en tiempo real y repuestos entregados al cliente."
                : (isOnlinePayment
                    ? "Pedido registrado en espera de confirmación y autorización de pago en pasarela online Culqi."
                    : ("DELIVERY".equals(deliveryType)
                        ? String.format("Pedido confirmado con validación geoespacial aprobada (%.2f km desde %s).",
                        calculatedDistance / 1000.0, branch.getName())
                        : "Pedido confirmado para recojo presencial en " + branch.getName() + "."));

        order.getStatusHistory().add(new OrderStatusHistory(
                order,
                null,
                initialStatus,
                currentUser,
                historyComment,
                Instant.now()
        ));

        CustomerOrder saved = orderRepository.save(order);
        catalogService.evictCatalogCache();
        OrderResponse response = toOrderResponse(saved);
        if (!isOnlinePayment && !isCounterSale) {
            emailNotificationService.notifyOrderCreated(response);
        }
        return response;
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getMyOrders(AppUser currentUser) {
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(currentUser.getId()).stream()
                .map(this::toOrderResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse trackByOrderNumber(String orderNumber) {
        String clean = orderNumber != null ? orderNumber.trim() : "";
        Optional<CustomerOrder> opt = orderRepository.findByOrderNumberIgnoreCase(clean);
        if (opt.isPresent()) {
            return toOrderResponse(opt.get());
        }
        if (clean.equalsIgnoreCase("ASU-2026-0001") || clean.equalsIgnoreCase("DEMO") || clean.startsWith("ASU-") || clean.startsWith("ORD-")) {
            return buildSyntheticDemoOrder(clean);
        }
        throw new ResourceNotFoundException("No se encontró ningún pedido con código: " + orderNumber);
    }

    private OrderResponse buildSyntheticDemoOrder(String code) {
        Instant now = Instant.now();
        List<OrderItemDto> items = List.of(
                new OrderItemDto(
                        1L, 101L, "ASU-ELE-004", "48881-NARVA",
                        "Foco Narva Halógeno H4 12V 60/55W RP Base P43t",
                        null, null, 2, new BigDecimal("45.00"), new BigDecimal("25.00"), new BigDecimal("90.00"), true
                ),
                new OrderItemDto(
                        2L, 102L, "ASU-FRE-001", "04465-0K240",
                        "Pastillas de Freno Delanteras Cerámicas Brembo",
                        null, null, 1, new BigDecimal("135.00"), new BigDecimal("80.00"), new BigDecimal("135.00"), true
                )
        );

        List<OrderStatusHistoryDto> history = List.of(
                new OrderStatusHistoryDto(1L, null, "CONFIRMADO", "Sistema Asunción ERP", "Pedido recibido y verificado", now.minusSeconds(3600)),
                new OrderStatusHistoryDto(2L, "CONFIRMADO", "EN_PREPARACION", "Operador de Almacén", "Repuestos empaquetados", now.minusSeconds(1800)),
                new OrderStatusHistoryDto(3L, "EN_PREPARACION", "LISTO_PARA_DESPACHO", "Operador de Almacén", "Guía y bulto asignado a despacho", now.minusSeconds(900)),
                new OrderStatusHistoryDto(4L, "LISTO_PARA_DESPACHO", "EN_RUTA", "Repartidor Motorizado", "En tránsito hacia el cliente", now.minusSeconds(300))
        );

        return new OrderResponse(
                9999L,
                code,
                "EN_RUTA",
                "DELIVERY",
                1L,
                "Luis Oscar Pérez",
                "luisoscarperez322@hotmail.com",
                "+51 922 779 157",
                "Luis Oscar Pérez",
                "+51 922 779 157",
                "BOLETA",
                "71156519",
                null,
                null,
                "Pago directo al contado (Pasarela en línea)",
                1L,
                "Sede Central Asunción",
                "Av. República de Panamá 4567, Surquillo, Lima",
                -12.0685,
                -77.0182,
                "Av. Arequipa 2450, Lince / San Isidro, Lima",
                "Piso 4, Dpto 402 - Timbre Pérez",
                -12.1120,
                -77.0320,
                6400.0,
                new BigDecimal("225.00"),
                new BigDecimal("40.50"),
                new BigDecimal("40.50"),
                new BigDecimal("15.00"),
                new BigDecimal("240.00"),
                "Entrega urgente a domicilio",
                "Empaque con sello de seguridad",
                1L,
                "Asesor Comercial Asunción",
                2L,
                "Operador de Almacén",
                3L,
                "Repartidor Motorizado Asunción",
                "+51 987 654 321",
                now.minusSeconds(3600),
                now,
                null,
                items,
                history,
                null,
                "7492",
                false
        );
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders(OrderStatus status) {
        List<CustomerOrder> orders = status != null
                ? orderRepository.findByStatusOrderByCreatedAtDesc(status)
                : orderRepository.findAllByOrderByCreatedAtDesc();
        return orders.stream()
                .map(this::toOrderResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getWarehouseOrders() {
        List<OrderStatus> warehouseStatuses = List.of(
                OrderStatus.CONFIRMADO,
                OrderStatus.EN_PREPARACION,
                OrderStatus.LISTO_PARA_DESPACHO
        );
        return orderRepository.findByStatusInOrderByCreatedAtAsc(warehouseStatuses).stream()
                .map(this::toOrderResponse)
                .toList();
    }

    @Transactional
    public OrderResponse toggleItemPicked(Long orderId, Long itemId, AppUser operator) {
        CustomerOrder order = findOrderOrThrow(orderId);
        OrderItem targetItem = order.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Ítem ID " + itemId + " no pertenece al pedido ID " + orderId));

        targetItem.setPicked(!targetItem.isPicked());
        if (order.getWarehouseOperator() == null) {
            order.setWarehouseOperator(operator);
        }

        CustomerOrder saved = orderRepository.save(order);
        return toOrderResponse(saved);
    }

    @Transactional
    public OrderResponse startPicking(Long orderId, AppUser operator) {
        CustomerOrder order = findOrderOrThrow(orderId);
        if (order.getStatus() == OrderStatus.ENTREGADO || order.getStatus() == OrderStatus.CANCELADO) {
            throw new BadRequestException("No se puede iniciar preparación de un pedido en estado " + order.getStatus());
        }

        OrderStatus prev = order.getStatus();
        order.setStatus(OrderStatus.EN_PREPARACION);
        order.setWarehouseOperator(operator);
        order.getStatusHistory().add(new OrderStatusHistory(
                order,
                prev,
                OrderStatus.EN_PREPARACION,
                operator,
                "Picking y verificación técnica iniciada en almacén por " + operator.getFullName() + ".",
                Instant.now()
        ));

        CustomerOrder saved = orderRepository.save(order);
        catalogService.evictCatalogCache();
        OrderResponse response = toOrderResponse(saved);
        emailNotificationService.notifyOrderInPreparation(response);
        return response;
    }

    @Transactional
    public OrderResponse markReadyForDispatch(Long orderId, ReadyForDispatchRequest req, AppUser operator) {
        CustomerOrder order = findOrderOrThrow(orderId);
        if (order.getStatus() == OrderStatus.ENTREGADO || order.getStatus() == OrderStatus.CANCELADO) {
            throw new BadRequestException("No se puede despachar un pedido en estado " + order.getStatus());
        }

        order.getItems().forEach(item -> item.setPicked(true));
        if (order.getWarehouseOperator() == null) {
            order.setWarehouseOperator(operator);
        }

        if (req != null) {
            if (req.warehouseNotes() != null && !req.warehouseNotes().isBlank()) {
                order.setWarehouseNotes(req.warehouseNotes().trim());
            }
            if (req.assignedDriverId() != null) {
                assignAvailableDriver(order, req.assignedDriverId());
            }
        }

        OrderStatus prev = order.getStatus();
        order.setStatus(OrderStatus.LISTO_PARA_DESPACHO);

        String driverNote = order.getAssignedDriver() != null
                ? " Motorizado asignado: " + order.getAssignedDriver().getFullName() + "."
                : " Disponible en zona de despacho.";

        order.getStatusHistory().add(new OrderStatusHistory(
                order,
                prev,
                OrderStatus.LISTO_PARA_DESPACHO,
                operator,
                "Picking completado al 100% y embalado listo para despacho." + driverNote,
                Instant.now()
        ));

        CustomerOrder saved = orderRepository.save(order);
        catalogService.evictCatalogCache();
        OrderResponse response = toOrderResponse(saved);
        emailNotificationService.notifyOrderReadyForDispatch(response);
        return response;
    }

    /**
     * Valida disponibilidad y asigna un repartidor motorizado a un pedido de entrega a domicilio.
     * Si el pedido tenía otro motorizado asignado sin otras entregas activas, lo libera.
     */
    private AppUser assignAvailableDriver(CustomerOrder order, Long driverId) {
        if ("PICKUP".equalsIgnoreCase(order.getDeliveryType())) {
            throw new BadRequestException("Un pedido de recojo en tienda no requiere asignación de repartidor.");
        }
        AppUser driver = userRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Motorizado no encontrado con ID: " + driverId));

        boolean alreadyAssignedToSame = order.getAssignedDriver() != null
                && order.getAssignedDriver().getId().equals(driver.getId());

        List<OrderStatus> activeDeliveryStatuses = List.of(OrderStatus.EN_RUTA, OrderStatus.LISTO_PARA_DESPACHO);
        Optional<CustomerOrder> activeOrderOpt = orderRepository.findByStatusInOrderByCreatedAtDesc(activeDeliveryStatuses).stream()
                .filter(o -> o.getAssignedDriver() != null && o.getAssignedDriver().getId().equals(driver.getId()) && !o.getId().equals(order.getId()))
                .findFirst();

        if ((!alreadyAssignedToSame && driver.getDriverStatus() != DriverStatus.DISPONIBLE) || activeOrderOpt.isPresent()) {
            String reason = activeOrderOpt.isPresent()
                    ? "está en pleno pedido (#" + activeOrderOpt.get().getOrderNumber() + ") y aún no ha finalizado la entrega."
                    : driver.getDriverStatus() == DriverStatus.EN_RUTA
                    ? "se encuentra en ruta de entrega."
                    : driver.getDriverStatus() == DriverStatus.RETORNANDO
                    ? "aún no regresa a la tienda (Estado: Retornando)."
                    : "se encuentra fuera de turno.";
            throw new BadRequestException("No se puede asignar al repartidor " + driver.getFullName() + ": " + reason + " Solo se pueden asignar pedidos a repartidores en estado DISPONIBLE.");
        }

        if (order.getAssignedDriver() != null && !alreadyAssignedToSame) {
            AppUser prevDriver = order.getAssignedDriver();
            boolean hasOtherActive = orderRepository.findByStatusInOrderByCreatedAtDesc(activeDeliveryStatuses).stream()
                    .anyMatch(o -> !o.getId().equals(order.getId())
                            && o.getAssignedDriver() != null
                            && o.getAssignedDriver().getId().equals(prevDriver.getId()));
            if (!hasOtherActive) {
                prevDriver.setDriverStatus(DriverStatus.DISPONIBLE);
                userRepository.save(prevDriver);
            }
        }

        driver.setDriverStatus(DriverStatus.EN_RUTA);
        userRepository.save(driver);
        order.setAssignedDriver(driver);
        return driver;
    }

    /**
     * Permite a ADMIN o VENDEDOR gestionar integralmente el cambio de estado operativo
     * tanto para Delivery (incluyendo asignación de repartidor) como para Recojo en tienda (cobro y entrega en mostrador).
     */
    @Transactional
    public OrderResponse updateOrderStatus(Long orderId, UpdateOrderStatusRequest req, AppUser currentUser) {
        if (currentUser == null || (!hasRole(currentUser, RoleName.ADMIN) && !hasRole(currentUser, RoleName.VENDEDOR))) {
            throw new BadRequestException("Solo administradores o vendedores pueden cambiar el estado operativo de los pedidos.");
        }
        if (req == null || req.status() == null || req.status().isBlank()) {
            throw new BadRequestException("Debe especificar el nuevo estado destino del pedido.");
        }

        CustomerOrder order = findOrderOrThrow(orderId);
        if (order.getStatus() == OrderStatus.ENTREGADO || order.getStatus() == OrderStatus.CANCELADO) {
            throw new BadRequestException("El pedido ya se encuentra en estado final (" + order.getStatus() + ") y no puede modificarse.");
        }

        OrderStatus targetStatus;
        try {
            targetStatus = OrderStatus.valueOf(req.status().trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Estado operativo inválido: " + req.status());
        }

        boolean isPickup = "PICKUP".equalsIgnoreCase(order.getDeliveryType());

        return switch (targetStatus) {
            case EN_PREPARACION -> startPicking(orderId, currentUser);
            case LISTO_PARA_DESPACHO -> markReadyForDispatch(
                    orderId,
                    new ReadyForDispatchRequest(isPickup ? null : req.assignedDriverId(), req.notes()),
                    currentUser
            );
            case EN_RUTA -> {
                if (isPickup) {
                    throw new BadRequestException("Un pedido de recojo en tienda se entrega en mostrador y no pasa a reparto motorizado.");
                }
                if (req.assignedDriverId() != null) {
                    assignAvailableDriver(order, req.assignedDriverId());
                } else if (order.getAssignedDriver() == null) {
                    throw new BadRequestException("Debes asignar un repartidor motorizado disponible antes de pasar el pedido a EN_RUTA.");
                } else {
                    order.getAssignedDriver().setDriverStatus(DriverStatus.EN_RUTA);
                    userRepository.save(order.getAssignedDriver());
                }
                order.getItems().forEach(item -> item.setPicked(true));
                OrderStatus prev = order.getStatus();
                order.setStatus(OrderStatus.EN_RUTA);
                String driverName = order.getAssignedDriver() != null ? order.getAssignedDriver().getFullName() : "Motorizado";
                order.getStatusHistory().add(new OrderStatusHistory(
                        order, prev, OrderStatus.EN_RUTA, currentUser,
                        "Despacho iniciado por " + currentUser.getFullName() + " con repartidor " + driverName + ".",
                        Instant.now()
                ));
                CustomerOrder saved = orderRepository.save(order);
                catalogService.evictCatalogCache();
                OrderResponse res = toOrderResponse(saved);
                emailNotificationService.notifyOrderInRoute(res);
                yield res;
            }
            case ENTREGADO -> {
                order.getItems().forEach(item -> item.setPicked(true));
                if (req.paymentMethod() != null && !req.paymentMethod().isBlank()) {
                    order.setPaymentMethod(req.paymentMethod().trim().toUpperCase());
                }
                DeliveryProof proof = order.getDeliveryProof() != null ? order.getDeliveryProof() : new DeliveryProof();
                proof.setOrder(order);
                proof.setReceiverName(firstNonBlank(req.receiverName(), order.getRecipientName(), order.getCustomer().getFullName(), "Cliente Titular"));
                proof.setReceiverDocument(firstNonBlank(req.receiverDocument(), order.getCustomerTaxId(), "Registrado"));

                if (isPickup) {
                    order.setAssignedDriver(null);
                    proof.setDriver(null);
                    String branchLabel = order.getBranch() != null ? order.getBranch().getName() : "tienda";
                    String extra = req.notes() != null && !req.notes().isBlank() ? " — " + req.notes().trim() : "";
                    proof.setDeliveryNotes("Entregado y verificado en mostrador (" + branchLabel + ")" + extra);
                } else {
                    if (order.getAssignedDriver() != null) {
                        proof.setDriver(order.getAssignedDriver());
                        order.getAssignedDriver().setDriverStatus(DriverStatus.DISPONIBLE);
                        userRepository.save(order.getAssignedDriver());
                    }
                    proof.setDeliveryNotes(firstNonBlank(req.notes(), "Entrega domiciliaria confirmada por administración."));
                }
                proof.setDeliveredAt(Instant.now());
                order.setDeliveryProof(proof);

                OrderStatus prev = order.getStatus();
                order.setStatus(OrderStatus.ENTREGADO);
                String comment = isPickup
                        ? "Pedido retirado y entregado en mostrador a " + proof.getReceiverName() + "."
                        : "Pedido entregado satisfactoriamente a " + proof.getReceiverName() + ".";
                order.getStatusHistory().add(new OrderStatusHistory(
                        order, prev, OrderStatus.ENTREGADO, currentUser, comment, proof.getDeliveredAt()
                ));
                CustomerOrder saved = orderRepository.save(order);
                catalogService.evictCatalogCache();
                OrderResponse res = toOrderResponse(saved);
                emailNotificationService.notifyOrderDelivered(res);
                yield res;
            }
            case CANCELADO -> cancelOrder(orderId, req.notes(), currentUser);
            default -> {
                OrderStatus prev = order.getStatus();
                order.setStatus(targetStatus);
                order.getStatusHistory().add(new OrderStatusHistory(
                        order, prev, targetStatus, currentUser,
                        firstNonBlank(req.notes(), "Estado actualizado manualmente a " + targetStatus + " por " + currentUser.getFullName() + "."),
                        Instant.now()
                ));
                CustomerOrder saved = orderRepository.save(order);
                catalogService.evictCatalogCache();
                yield toOrderResponse(saved);
            }
        };
    }

    @Transactional
    public void autoReconcileReturningDrivers() {
        try {
            List<AppUser> returningDrivers = userRepository.findAll().stream()
                    .filter(u -> u.getDriverStatus() == DriverStatus.RETORNANDO)
                    .toList();
            if (returningDrivers.isEmpty()) return;

            Instant now = Instant.now();
            for (AppUser driver : returningDrivers) {
                List<CustomerOrder> deliveredOrders = orderRepository.findAll().stream()
                        .filter(o -> o.getStatus() == OrderStatus.ENTREGADO && o.getAssignedDriver() != null && o.getAssignedDriver().getId().equals(driver.getId()))
                        .filter(o -> o.getDeliveryProof() != null && o.getDeliveryProof().getDeliveredAt() != null)
                        .sorted((a, b) -> b.getDeliveryProof().getDeliveredAt().compareTo(a.getDeliveryProof().getDeliveredAt()))
                        .toList();

                if (!deliveredOrders.isEmpty()) {
                    CustomerOrder lastOrder = deliveredOrders.get(0);
                    Instant deliveredAt = lastOrder.getDeliveryProof().getDeliveredAt();
                    double distance = lastOrder.getCalculatedDistanceMeters() != null ? lastOrder.getCalculatedDistanceMeters() : 4000.0;
                    long maxReturnMinutes = Math.min(25, Math.max(3, (long) Math.ceil((distance / 350.0) + 3)));
                    if (deliveredAt.plus(java.time.Duration.ofMinutes(maxReturnMinutes)).isBefore(now)) {
                        driver.setDriverStatus(DriverStatus.DISPONIBLE);
                        userRepository.save(driver);
                    }
                } else {
                    driver.setDriverStatus(DriverStatus.DISPONIBLE);
                    userRepository.save(driver);
                }
            }
        } catch (Exception e) {
            // Non-blocking
        }
    }

    @Transactional(readOnly = true)
    public List<DriverSummaryDto> getDrivers() {
        List<OrderStatus> activeDeliveryStatuses = List.of(OrderStatus.EN_RUTA, OrderStatus.LISTO_PARA_DESPACHO);
        List<CustomerOrder> activeOrders = orderRepository.findByStatusInOrderByCreatedAtDesc(activeDeliveryStatuses);

        return userRepository.findActiveByRole(RoleName.MOTORIZADO).stream()
                .map(u -> {
                    Optional<CustomerOrder> active = activeOrders.stream()
                            .filter(o -> o.getAssignedDriver() != null && o.getAssignedDriver().getId().equals(u.getId()))
                            .findFirst();

                    DriverStatus effStatus = u.getDriverStatus();
                    String activeOrderNumber = null;
                    if (active.isPresent()) {
                        effStatus = DriverStatus.EN_RUTA;
                        activeOrderNumber = active.get().getOrderNumber();
                    }
                    return new DriverSummaryDto(
                            u.getId(),
                            u.getFullName(),
                            u.getPhone(),
                            u.getEmail(),
                            effStatus != null ? effStatus : DriverStatus.DISPONIBLE,
                            activeOrderNumber
                    );
                })
                .toList();
    }

    @Transactional
    public List<OrderResponse> getDeliveryOrders(AppUser currentUser) {
        autoReconcileReturningDrivers();
        boolean isAdmin = hasRole(currentUser, RoleName.ADMIN);
        List<OrderStatus> statuses = List.of(
                OrderStatus.LISTO_PARA_DESPACHO,
                OrderStatus.EN_RUTA
        );

        return orderRepository.findByStatusInOrderByCreatedAtDesc(statuses).stream()
                .filter(order -> "DELIVERY".equalsIgnoreCase(order.getDeliveryType()) || order.getAssignedDriver() != null)
                .filter(order -> {
                    if (isAdmin) {
                        return true;
                    }
                    if (order.getStatus() == OrderStatus.LISTO_PARA_DESPACHO) {
                        return order.getAssignedDriver() == null
                                || order.getAssignedDriver().getId().equals(currentUser.getId());
                    }
                    return order.getAssignedDriver() != null
                            && order.getAssignedDriver().getId().equals(currentUser.getId());
                })
                .sorted(Comparator.comparingInt((CustomerOrder o) -> switch (o.getStatus()) {
                    case EN_RUTA -> 0;
                    case LISTO_PARA_DESPACHO -> 1;
                    default -> 2;
                }).thenComparing(CustomerOrder::getCreatedAt, Comparator.reverseOrder()))
                .map(this::toOrderResponse)
                .toList();
    }

    @Transactional
    public OrderResponse startRoute(Long orderId, AppUser currentUser) {
        CustomerOrder order = findOrderOrThrow(orderId);
        if (order.getStatus() != OrderStatus.LISTO_PARA_DESPACHO && order.getStatus() != OrderStatus.EN_RUTA) {
            throw new BadRequestException("El pedido debe estar en estado LISTO_PARA_DESPACHO para iniciar ruta GPS.");
        }

        if (order.getAssignedDriver() == null || hasRole(currentUser, RoleName.MOTORIZADO)) {
            order.setAssignedDriver(currentUser);
        }

        AppUser driver = order.getAssignedDriver() != null ? order.getAssignedDriver() : currentUser;
        if (driver != null) {
            driver.setDriverStatus(DriverStatus.EN_RUTA);
            userRepository.save(driver);
        }

        OrderStatus prev = order.getStatus();
        order.setStatus(OrderStatus.EN_RUTA);
        order.getStatusHistory().add(new OrderStatusHistory(
                order,
                prev,
                OrderStatus.EN_RUTA,
                currentUser,
                "Unidad motorizada en ruta GPS hacia destino de entrega (" + (driver != null ? driver.getFullName() : "Repartidor") + ").",
                Instant.now()
        ));

        CustomerOrder saved = orderRepository.save(order);
        catalogService.evictCatalogCache();
        OrderResponse response = toOrderResponse(saved);
        emailNotificationService.notifyOrderInRoute(response);
        return response;
    }

    @Transactional
    public OrderResponse completeDelivery(
            Long orderId,
            MultipartFile evidenceImage,
            String receiverName,
            String receiverDocument,
            String deliveryNotes,
            Double capturedLatitude,
            Double capturedLongitude,
            AppUser currentUser
    ) {
        return completeDelivery(orderId, evidenceImage, receiverName, receiverDocument, deliveryNotes, capturedLatitude, capturedLongitude, null, currentUser);
    }

    @Transactional
    public OrderResponse completeDelivery(
            Long orderId,
            MultipartFile evidenceImage,
            String receiverName,
            String receiverDocument,
            String deliveryNotes,
            Double capturedLatitude,
            Double capturedLongitude,
            String securityCode,
            AppUser currentUser
    ) {
        CustomerOrder order = findOrderOrThrow(orderId);
        if (order.getStatus() == OrderStatus.CANCELADO) {
            throw new BadRequestException("No se puede completar la entrega de un pedido cancelado.");
        }

        // Validación estricta del código único de seguridad del cliente antes de permitir finalizar la entrega
        if ("DELIVERY".equalsIgnoreCase(order.getDeliveryType())) {
            String expectedCode = order.getDeliverySecurityCode();
            if (expectedCode == null || expectedCode.isBlank()) {
                expectedCode = String.format(Locale.US, "%04d", Math.abs((order.getId() != null ? order.getId() : 1L) * 37L + 1000L) % 9000L + 1000L);
                order.setDeliverySecurityCode(expectedCode);
            }
            if (securityCode == null || !expectedCode.trim().equalsIgnoreCase(securityCode.trim())) {
                throw new BadRequestException("Código de seguridad de entrega incorrecto. Solicita al cliente su PIN de 4 dígitos que figura en su pantalla de seguimiento.");
            }
        }
        if (order.getStatus() == OrderStatus.CANCELADO) {
            throw new BadRequestException("No se puede completar la entrega de un pedido cancelado.");
        }

        AppUser effectiveDriver = order.getAssignedDriver() != null ? order.getAssignedDriver() : currentUser;
        order.setAssignedDriver(effectiveDriver);

        if (effectiveDriver != null) {
            effectiveDriver.setDriverStatus(DriverStatus.RETORNANDO);
            userRepository.save(effectiveDriver);
        }

        String evidenceObjectKey = null;
        String evidenceUrl = null;
        if (evidenceImage != null && !evidenceImage.isEmpty()) {
            try {
                ImageOptimizationService.OptimizedImage optimized = imageOptimizationService.optimize(evidenceImage.getInputStream());
                StorageService.StoredObject stored = storageService.store(
                        "deliveries",
                        order.getOrderNumber().toLowerCase(),
                        optimized.bytes(),
                        optimized.mimeType(),
                        optimized.extension()
                );
                evidenceObjectKey = stored.objectKey();
                evidenceUrl = stored.publicUrl();
            } catch (IOException e) {
                throw new BadRequestException("No se pudo procesar la foto de evidencia de recepción: " + e.getMessage());
            }
        }

        DeliveryProof proof = order.getDeliveryProof() != null ? order.getDeliveryProof() : new DeliveryProof();
        proof.setOrder(order);
        proof.setDriver(effectiveDriver);
        proof.setReceiverName(receiverName != null && !receiverName.isBlank()
                ? receiverName.trim()
                : firstNonBlank(order.getRecipientName(), order.getCustomer().getFullName()));
        proof.setReceiverDocument(receiverDocument != null && !receiverDocument.isBlank()
                ? receiverDocument.trim()
                : order.getCustomerTaxId());
        proof.setDeliveryNotes(deliveryNotes != null && !deliveryNotes.isBlank() ? deliveryNotes.trim() : null);
        if (evidenceUrl != null) {
            proof.setEvidenceObjectKey(evidenceObjectKey);
            proof.setEvidenceImageUrl(evidenceUrl);
        }
        if (capturedLatitude != null && capturedLongitude != null) {
            proof.setCapturedLocation(geospatialCoverageService.createWgs84Point(capturedLongitude, capturedLatitude));
        } else if (order.getDeliveryLocation() != null) {
            proof.setCapturedLocation(order.getDeliveryLocation());
        }
        proof.setDeliveredAt(Instant.now());
        order.setDeliveryProof(proof);

        OrderStatus prev = order.getStatus();
        order.setStatus(OrderStatus.ENTREGADO);
        order.getStatusHistory().add(new OrderStatusHistory(
                order,
                prev,
                OrderStatus.ENTREGADO,
                currentUser,
                "Pedido entregado satisfactoriamente a " + proof.getReceiverName() + ".",
                proof.getDeliveredAt()
        ));

        CustomerOrder saved = orderRepository.save(order);
        catalogService.evictCatalogCache();
        OrderResponse response = toOrderResponse(saved);
        emailNotificationService.notifyOrderDelivered(response);
        return response;
    }


    @Transactional
    public OrderResponse cancelOrder(Long orderId, String reason, AppUser currentUser) {
        CustomerOrder order = findOrderOrThrow(orderId);
        if (order.getStatus() == OrderStatus.ENTREGADO) {
            throw new BadRequestException("No se puede cancelar un pedido que ya figura como ENTREGADO.");
        }
        if (order.getStatus() == OrderStatus.CANCELADO) {
            throw new BadRequestException("El pedido ya se encuentra CANCELADO.");
        }

        // Restituir stock físico en almacén para cada repuesto del pedido
        for (OrderItem item : order.getItems()) {
            Part part = item.getPart();
            int newStock = part.getStockQuantity() + item.getQuantity();
            part.setStockQuantity(newStock);
            partRepository.save(part);
            stockReservationService.reconcileHoldsForPart(part.getId(), newStock);
        }

        OrderStatus prev = order.getStatus();
        order.setStatus(OrderStatus.CANCELADO);

        // Si tenía un motorizado asignado y estaba en ruta, liberar al motorizado
        if (order.getAssignedDriver() != null) {
            AppUser driver = order.getAssignedDriver();
            driver.setDriverStatus(DriverStatus.DISPONIBLE);
            userRepository.save(driver);
        }

        String actorName = currentUser != null ? currentUser.getFullName() : "Sistema Automático ERP Asunción";
        String cancelComment = (reason != null && !reason.isBlank())
                ? "Pedido cancelado / no recibido. Motivo: " + reason.trim() + ". Stock de repuestos reincorporado al inventario disponible."
                : "Pedido cancelado por " + actorName + ". Stock restituido automáticamente al almacén.";

        order.getStatusHistory().add(new OrderStatusHistory(
                order,
                prev,
                OrderStatus.CANCELADO,
                currentUser,
                cancelComment,
                Instant.now()
        ));

        CustomerOrder saved = orderRepository.save(order);
        catalogService.evictCatalogCache();
        return toOrderResponse(saved);
    }


    /**
     * Automatización de Logística Inversa para Recojo en Tienda:
     * Cancela automáticamente pedidos de recojo en tienda que hayan excedido el plazo límite
     * de 48 horas sin ser retirados, devolviendo los repuestos al stock disponible.
     */
    @Scheduled(fixedDelay = 600_000) // Se ejecuta automáticamente cada 10 minutos
    @Transactional
    public int autoCancelExpiredPickupOrders() {
        Instant threshold = Instant.now().minus(48, ChronoUnit.HOURS);
        List<OrderStatus> activeStatuses = List.of(
                OrderStatus.CONFIRMADO,
                OrderStatus.RESERVADO,
                OrderStatus.PENDIENTE,
                OrderStatus.LISTO_PARA_DESPACHO
        );

        List<CustomerOrder> expiredPickups = orderRepository.findByStatusInOrderByCreatedAtDesc(activeStatuses).stream()
                .filter(o -> "PICKUP".equalsIgnoreCase(o.getDeliveryType()))
                .filter(o -> o.getCreatedAt() != null && o.getCreatedAt().isBefore(threshold))
                .toList();

        int cancelledCount = 0;
        for (CustomerOrder order : expiredPickups) {
            cancelOrder(
                    order.getId(),
                    "Vencimiento automático de plazo límite de 48 horas (2 días hábiles) para recojo en tienda. Stock devuelto al inventario disponible.",
                    null
            );
            cancelledCount++;
        }
        return cancelledCount;
    }

    @Transactional
    public DriverSummaryDto updateDriverStatus(Long driverId, DriverStatus newStatus, AppUser currentUser) {
        AppUser driver = userRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Motorizado no encontrado con ID: " + driverId));

        if (!hasRole(currentUser, RoleName.ADMIN) && !driver.getId().equals(currentUser.getId())) {
            throw new BadRequestException("No tienes permisos para modificar el estado de este repartidor.");
        }

        if (newStatus == DriverStatus.DISPONIBLE) {
            boolean hasActive = orderRepository.findByStatusInOrderByCreatedAtDesc(List.of(OrderStatus.EN_RUTA)).stream()
                    .anyMatch(o -> o.getAssignedDriver() != null && o.getAssignedDriver().getId().equals(driver.getId()));
            if (hasActive) {
                throw new BadRequestException("No puedes marcarte como DISPONIBLE porque aún tienes un pedido en ruta de entrega.");
            }
        }

        driver.setDriverStatus(newStatus);
        userRepository.save(driver);
        return new DriverSummaryDto(driver.getId(), driver.getFullName(), driver.getPhone(), driver.getEmail(), driver.getDriverStatus(), null);
    }

    public OrderResponse toOrderResponse(CustomerOrder o) {
        List<OrderItemDto> itemDtos = o.getItems().stream()
                .map(i -> {
                    BigDecimal lineSub = i.getUnitSalePrice()
                            .multiply(BigDecimal.valueOf(i.getQuantity()))
                            .setScale(2, RoundingMode.HALF_UP);
                    return new OrderItemDto(
                            i.getId(),
                            i.getPart().getId(),
                            i.getPart().getSku(),
                            i.getPart().getOemCode(),
                            i.getPart().getName(),
                            i.getPart().getWarehouseLocation(),
                            catalogService.extractPrimaryImageUrl(i.getPart()),
                            i.getQuantity(),
                            i.getUnitSalePrice(),
                            i.getUnitPurchaseCost(),
                            lineSub,
                            i.isPicked()
                    );
                })
                .toList();

        List<OrderStatusHistoryDto> historyDtos = o.getStatusHistory().stream()
                .map(h -> new OrderStatusHistoryDto(
                        h.getId(),
                        h.getPreviousStatus() != null ? h.getPreviousStatus().name() : null,
                        h.getNewStatus().name(),
                        h.getChangedBy() != null ? h.getChangedBy().getFullName() : "Sistema ERP Asunción",
                        h.getComment(),
                        h.getChangedAt()
                ))
                .toList();

        DeliveryProofDto proofDto = null;
        Instant deliveredAt = null;
        if (o.getDeliveryProof() != null) {
            DeliveryProof dp = o.getDeliveryProof();
            deliveredAt = dp.getDeliveredAt();
            Double capLat = dp.getCapturedLocation() != null ? dp.getCapturedLocation().getY() : null;
            Double capLng = dp.getCapturedLocation() != null ? dp.getCapturedLocation().getX() : null;
            proofDto = new DeliveryProofDto(
                    dp.getId(),
                    dp.getReceiverName(),
                    dp.getReceiverDocument(),
                    dp.getEvidenceImageUrl(),
                    dp.getDeliveryNotes(),
                    capLat,
                    capLng,
                    dp.getDeliveredAt()
            );
        } else if (o.getStatus() == OrderStatus.ENTREGADO) {
            deliveredAt = o.getUpdatedAt();
        }

        Double delLat = o.getDeliveryLocation() != null ? o.getDeliveryLocation().getY() : null;
        Double delLng = o.getDeliveryLocation() != null ? o.getDeliveryLocation().getX() : null;
        Double brLat = o.getBranch() != null && o.getBranch().getLocation() != null ? o.getBranch().getLocation().getY() : null;
        Double brLng = o.getBranch() != null && o.getBranch().getLocation() != null ? o.getBranch().getLocation().getX() : null;

        String secCode = o.getDeliverySecurityCode();
        if (secCode == null || secCode.isBlank()) {
            secCode = String.format(Locale.US, "%04d", Math.abs((o.getId() != null ? o.getId() : 1L) * 37L + 1000L) % 9000L + 1000L);
        }

        return new OrderResponse(
                o.getId(),
                o.getOrderNumber(),
                o.getStatus().name(),
                o.getDeliveryType(),
                o.getCustomer().getId(),
                o.getCustomer().getFullName(),
                o.getCustomer().getEmail(),
                o.getCustomer().getPhone(),
                o.getRecipientName(),
                o.getRecipientPhone(),
                o.getInvoiceType(),
                o.getCustomerTaxId(),
                o.getCustomerBusinessName(),
                o.getBillingAddress(),
                o.getPaymentMethod(),
                o.getBranch().getId(),
                o.getBranch().getName(),
                o.getBranch().getAddress(),
                brLat,
                brLng,
                o.getDeliveryAddress(),
                o.getDeliveryReference(),
                delLat,
                delLng,
                o.getCalculatedDistanceMeters(),
                o.getSubtotal(),
                o.getTaxAmount(),
                o.getTaxAmount(),
                o.getDeliveryFee(),
                o.getTotalAmount(),
                o.getNotes(),
                o.getWarehouseNotes(),
                o.getSalesperson() != null ? o.getSalesperson().getId() : null,
                o.getSalesperson() != null ? o.getSalesperson().getFullName() : null,
                o.getWarehouseOperator() != null ? o.getWarehouseOperator().getId() : null,
                o.getWarehouseOperator() != null ? o.getWarehouseOperator().getFullName() : null,
                o.getAssignedDriver() != null ? o.getAssignedDriver().getId() : null,
                o.getAssignedDriver() != null ? o.getAssignedDriver().getFullName() : null,
                o.getAssignedDriver() != null ? o.getAssignedDriver().getPhone() : null,
                o.getCreatedAt(),
                o.getUpdatedAt(),
                deliveredAt,
                itemDtos,
                historyDtos,
                proofDto,
                secCode,
                Boolean.TRUE.equals(o.getProximityAlertSent())
        );
    }

    private CustomerOrder findOrderOrThrow(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado con ID: " + id));
    }

    private synchronized String generateNextOrderNumber() {
        int year = Year.now().getValue();
        long baseSeq = orderRepository.count() + 1;
        while (true) {
            String candidate = String.format("ASN-%d-%04d", year, baseSeq);
            if (orderRepository.findByOrderNumberIgnoreCase(candidate).isEmpty()) {
                return candidate;
            }
            baseSeq++;
        }
    }

    private String normalizeDeliveryType(String raw) {
        if (raw == null || raw.isBlank()) {
            return "DELIVERY";
        }
        String u = raw.trim().toUpperCase();
        if (u.contains("PICKUP") || u.contains("RECOJO") || u.contains("TIENDA") || u.contains("MOSTRADOR") || u.contains("PRESENCIAL")) {
            return "PICKUP";
        }
        return "DELIVERY";
    }

    private void applySunatBillingRules(
            CustomerOrder order,
            OrderCreateRequest req,
            AppUser currentUser,
            boolean isCounterSale,
            BigDecimal totalAmount
    ) {
        boolean explicitDocSent = req.billingDocumentNumber() != null || req.customerTaxId() != null;
        String rawDoc = explicitDocSent
                ? firstNonBlank(req.billingDocumentNumber(), req.customerTaxId())
                : (!isCounterSale ? firstNonBlank(currentUser.getDocumentNumber()) : null);
        String trimmedDoc = rawDoc != null ? rawDoc.trim() : "";
        if (trimmedDoc.matches("^0+$")) {
            trimmedDoc = "";
        }

        String digitsOnly = trimmedDoc.replaceAll("\\D", "");
        String invoiceType = normalizeInvoiceType(req.invoiceType(), digitsOnly);
        order.setInvoiceType(invoiceType);

        if ("FACTURA".equals(invoiceType)) {
            if (digitsOnly.length() != 11) {
                throw new BadRequestException("Para emitir Factura Electrónica es obligatorio ingresar un R.U.C. válido de 11 dígitos.");
            }
            String businessName = firstNonBlank(
                    req.billingBusinessName(),
                    req.customerBusinessName(),
                    !isCounterSale ? currentUser.getFullName() : null
            );
            if (businessName == null || isAnonymousPlaceholder(businessName)) {
                throw new BadRequestException("Para emitir Factura Electrónica es obligatorio ingresar la Razón Social de la empresa.");
            }
            order.setCustomerTaxId(digitsOnly);
            order.setCustomerBusinessName(businessName);
            order.setBillingAddress(firstNonBlank(req.billingAddress(), order.getDeliveryAddress()));
            return;
        }

        // BOLETA: Venta >= S/ 700 exige DNI/CE y nombres completos; < S/ 700 permite Clientes Varios
        String alphaNumDoc = trimmedDoc.replaceAll("[^A-Za-z0-9]", "");
        String customerName = firstNonBlank(
                req.billingBusinessName(),
                req.customerBusinessName(),
                req.recipientName(),
                !isCounterSale ? currentUser.getFullName() : null
        );

        if (totalAmount != null && totalAmount.compareTo(BOLETA_DNI_THRESHOLD) >= 0) {
            if (alphaNumDoc.length() < 8) {
                throw new BadRequestException("Por norma SUNAT, toda Boleta de Venta por S/ 700.00 o más exige DNI (8 dígitos) o Carnet de Extranjería/Pasaporte.");
            }
            if (customerName == null || isAnonymousPlaceholder(customerName)) {
                throw new BadRequestException("Por norma SUNAT, toda Boleta de Venta por S/ 700.00 o más exige nombres y apellidos completos del cliente.");
            }
        }

        order.setCustomerTaxId(alphaNumDoc.isEmpty() ? null : trimmedDoc);
        if (customerName == null || isAnonymousPlaceholder(customerName)) {
            order.setCustomerBusinessName("CLIENTES VARIOS");
            if (isCounterSale) {
                order.setRecipientName("CLIENTES VARIOS");
            }
        } else {
            order.setCustomerBusinessName(customerName);
        }
        order.setBillingAddress(firstNonBlank(req.billingAddress()));
    }

    private boolean isAnonymousPlaceholder(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            return true;
        }
        String norm = rawName.trim().toUpperCase(Locale.ROOT);
        return norm.equals("CLIENTES VARIOS")
                || norm.equals("CLIENTE EN CAJA")
                || norm.equals("CLIENTE GENERAL")
                || norm.equals("CLIENTE DE MOSTRADOR")
                || norm.equals("CONSUMIDOR FINAL");
    }

    private String normalizeInvoiceType(String raw, String digitsOnly) {
        if (digitsOnly != null && !digitsOnly.isBlank()) {
            if (digitsOnly.length() == 11) {
                return "FACTURA";
            }
            if (digitsOnly.length() == 8 && (raw == null || !raw.trim().equalsIgnoreCase("FACTURA"))) {
                return "BOLETA";
            }
        }
        if (raw != null && !raw.isBlank()) {
            String u = raw.trim().toUpperCase(Locale.ROOT);
            if ("FACTURA".equals(u) || "BOLETA".equals(u)) {
                return u;
            }
        }
        return "BOLETA";
    }

    private boolean hasRole(AppUser user, RoleName roleName) {
        return user.getRoles().stream().anyMatch(r -> r.getName() == roleName);
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    private boolean isOnlinePaymentMethod(String method) {
        if (method == null) return false;
        String m = method.trim().toUpperCase();
        return m.contains("TARJETA") || m.contains("CULQI") || m.contains("DEBITO") 
                || m.contains("CREDITO") || m.contains("PAGOEFECTIVO") || m.equals("ONLINE");
    }
}

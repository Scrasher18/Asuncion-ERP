package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.*;
import com.asuncion.erp.domain.enums.OrderStatus;
import com.asuncion.erp.domain.enums.RoleName;
import com.asuncion.erp.dto.analytics.*;
import com.asuncion.erp.repository.CustomerOrderRepository;
import com.asuncion.erp.repository.PartRepository;
import com.asuncion.erp.repository.SalesQuotaRepository;
import com.asuncion.erp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class AnalyticsService {

    private static final BigDecimal DEFAULT_MONTHLY_QUOTA = new BigDecimal("35000.00");

    private final CustomerOrderRepository orderRepository;
    private final PartRepository partRepository;
    private final UserRepository userRepository;
    private final SalesQuotaRepository salesQuotaRepository;

    public AnalyticsService(
            CustomerOrderRepository orderRepository,
            PartRepository partRepository,
            UserRepository userRepository,
            SalesQuotaRepository salesQuotaRepository
    ) {
        this.orderRepository = orderRepository;
        this.partRepository = partRepository;
        this.userRepository = userRepository;
        this.salesQuotaRepository = salesQuotaRepository;
    }

    @Transactional(readOnly = true)
    public DashboardAnalyticsResponse getDashboardAnalytics(int days) {
        int safeDays = days > 0 ? days : 30;
        Instant now = Instant.now();
        Instant cutoff = now.minus(safeDays, ChronoUnit.DAYS);

        List<CustomerOrder> allOrders = orderRepository.findAllByOrderByCreatedAtDesc();
        List<CustomerOrder> periodValidOrders = allOrders.stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELADO)
                .filter(o -> !o.getCreatedAt().isBefore(cutoff))
                .toList();

        List<Part> activeParts = partRepository.findByActiveTrueOrderByIdAsc();

        // 1. KPIs
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal grossProfit = BigDecimal.ZERO;
        long deliveredOrders = 0;

        Map<String, BigDecimal> categoryAmountMap = new HashMap<>();
        Map<String, Long> categoryUnitsMap = new HashMap<>();

        Map<Long, Long> partUnitsSoldMap = new HashMap<>();
        Map<Long, BigDecimal> partRevenueMap = new HashMap<>();
        Map<Long, Instant> partLastSaleMap = new HashMap<>();

        for (CustomerOrder order : allOrders) {
            if (order.getStatus() == OrderStatus.CANCELADO) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                Long partId = item.getPart().getId();
                Instant currentMax = partLastSaleMap.get(partId);
                if (currentMax == null || order.getCreatedAt().isAfter(currentMax)) {
                    partLastSaleMap.put(partId, order.getCreatedAt());
                }
            }
        }

        for (CustomerOrder order : periodValidOrders) {
            totalRevenue = totalRevenue.add(order.getTotalAmount());
            if (order.getStatus() == OrderStatus.ENTREGADO) {
                deliveredOrders++;
            }

            for (OrderItem item : order.getItems()) {
                long qty = item.getQuantity();
                BigDecimal lineRevenue = item.getUnitSalePrice().multiply(BigDecimal.valueOf(qty));
                BigDecimal lineProfit = item.getUnitSalePrice()
                        .subtract(item.getUnitPurchaseCost())
                        .multiply(BigDecimal.valueOf(qty));

                grossProfit = grossProfit.add(lineProfit);

                Long partId = item.getPart().getId();
                partUnitsSoldMap.merge(partId, qty, Long::sum);
                partRevenueMap.merge(partId, lineRevenue, BigDecimal::add);

                String catName = item.getPart().getCategory().getName();
                categoryAmountMap.merge(catName, lineRevenue, BigDecimal::add);
                categoryUnitsMap.merge(catName, qty, Long::sum);
            }
        }

        long totalOrders = periodValidOrders.size();
        BigDecimal averageTicket = totalOrders > 0
                ? totalRevenue.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        long inTransitOrders = orderRepository.countByStatusIn(List.of(
                OrderStatus.LISTO_PARA_DESPACHO,
                OrderStatus.EN_RUTA
        ));
        long pendingWarehouseOrders = orderRepository.countByStatusIn(List.of(
                OrderStatus.PENDIENTE,
                OrderStatus.CONFIRMADO,
                OrderStatus.EN_PREPARACION
        ));
        long lowStockPartsCount = activeParts.stream()
                .filter(p -> p.getStockQuantity() <= p.getMinStockLevel())
                .count();
        BigDecimal totalInventoryValue = activeParts.stream()
                .map(p -> p.getPurchasePrice().multiply(BigDecimal.valueOf(p.getStockQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        DashboardKpisDto kpis = new DashboardKpisDto(
                totalRevenue.setScale(2, RoundingMode.HALF_UP),
                grossProfit.setScale(2, RoundingMode.HALF_UP),
                totalOrders,
                averageTicket,
                deliveredOrders,
                inTransitOrders,
                pendingWarehouseOrders,
                lowStockPartsCount,
                totalInventoryValue
        );

        // 2. Salesperson Dynamic Ranking
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        short currentYear = (short) today.getYear();
        short currentMonth = (short) today.getMonthValue();
        Map<Long, BigDecimal> quotaByUser = new HashMap<>();
        salesQuotaRepository.findByPeriodYearAndPeriodMonth(currentYear, currentMonth)
                .forEach(sq -> quotaByUser.put(sq.getSalesperson().getId(), sq.getTargetAmount()));

        List<AppUser> salespeople = userRepository.findActiveByRole(RoleName.VENDEDOR);
        List<SalespersonRankingDto> rawRankings = new ArrayList<>();

        for (AppUser sp : salespeople) {
            List<CustomerOrder> spOrders = periodValidOrders.stream()
                    .filter(o -> o.getSalesperson() != null && o.getSalesperson().getId().equals(sp.getId()))
                    .filter(o -> o.getStatus() != OrderStatus.PENDIENTE)
                    .toList();

            long closedTx = spOrders.size();
            BigDecimal volume = spOrders.stream()
                    .map(CustomerOrder::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);

            BigDecimal quota = quotaByUser.getOrDefault(sp.getId(), DEFAULT_MONTHLY_QUOTA).setScale(2, RoundingMode.HALF_UP);
            double achievement = quota.compareTo(BigDecimal.ZERO) > 0
                    ? volume.multiply(BigDecimal.valueOf(100.0))
                        .divide(quota, 2, RoundingMode.HALF_UP)
                        .doubleValue()
                    : 0.0;
            BigDecimal spAvgTicket = closedTx > 0
                    ? volume.divide(BigDecimal.valueOf(closedTx), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

            rawRankings.add(new SalespersonRankingDto(
                    sp.getId(),
                    sp.getFullName(),
                    sp.getEmail(),
                    closedTx,
                    volume,
                    quota,
                    achievement,
                    spAvgTicket,
                    0
            ));
        }

        rawRankings.sort(Comparator
                .comparing(SalespersonRankingDto::totalSalesVolume, Comparator.reverseOrder())
                .thenComparing(SalespersonRankingDto::closedTransactions, Comparator.reverseOrder())
                .thenComparing(SalespersonRankingDto::fullName));

        List<SalespersonRankingDto> salespersonRanking = new ArrayList<>();
        for (int i = 0; i < rawRankings.size(); i++) {
            SalespersonRankingDto r = rawRankings.get(i);
            salespersonRanking.add(new SalespersonRankingDto(
                    r.salespersonId(),
                    r.fullName(),
                    r.email(),
                    r.closedTransactions(),
                    r.totalSalesVolume(),
                    r.monthlyQuota(),
                    r.quotaAchievementPercent(),
                    r.averageTicket(),
                    i + 1
            ));
        }

        // 3. High Rotation Parts
        List<HighRotationPartDto> highRotationParts = activeParts.stream()
                .filter(p -> partUnitsSoldMap.getOrDefault(p.getId(), 0L) > 0)
                .map(p -> {
                    long sold = partUnitsSoldMap.getOrDefault(p.getId(), 0L);
                    BigDecimal rev = partRevenueMap.getOrDefault(p.getId(), BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
                    double avgStock = Math.max(1.0, (p.getStockQuantity() + sold) / 2.0);
                    double turnover = BigDecimal.valueOf(sold / avgStock).setScale(2, RoundingMode.HALF_UP).doubleValue();
                    return new HighRotationPartDto(
                            p.getId(),
                            p.getSku(),
                            p.getOemCode(),
                            p.getName(),
                            p.getCategory().getName(),
                            sold,
                            rev,
                            p.getStockQuantity(),
                            p.getMinStockLevel(),
                            turnover
                    );
                })
                .sorted(Comparator
                        .comparingLong(HighRotationPartDto::unitsSold).reversed()
                        .thenComparing(HighRotationPartDto::revenueGenerated, Comparator.reverseOrder()))
                .limit(8)
                .toList();

        // 4. Low Rotation / Stagnant Parts (including 0 sales)
        List<LowRotationPartDto> lowRotationParts = activeParts.stream()
                .map(p -> {
                    long sold = partUnitsSoldMap.getOrDefault(p.getId(), 0L);
                    BigDecimal immobilized = p.getPurchasePrice()
                            .multiply(BigDecimal.valueOf(p.getStockQuantity()))
                            .setScale(2, RoundingMode.HALF_UP);
                    Instant lastSale = partLastSaleMap.get(p.getId());
                    Instant referenceDate = lastSale != null ? lastSale : p.getCreatedAt();
                    long daysSince = Math.max(0L, ChronoUnit.DAYS.between(referenceDate, now));
                    if (lastSale == null && daysSince == 0) {
                        daysSince = safeDays;
                    }
                    String status = sold == 0
                            ? "SIN_MOVIMIENTO"
                            : (sold <= 2 ? "ROTACION_CRITICA" : "BAJA_ROTACION");
                    return new LowRotationPartDto(
                            p.getId(),
                            p.getSku(),
                            p.getOemCode(),
                            p.getName(),
                            p.getCategory().getName(),
                            sold,
                            p.getStockQuantity(),
                            immobilized,
                            daysSince,
                            status
                    );
                })
                .sorted(Comparator
                        .comparingLong(LowRotationPartDto::unitsSold)
                        .thenComparing(LowRotationPartDto::immobilizedCapital, Comparator.reverseOrder()))
                .limit(8)
                .toList();

        // 5. Sales by Category
        List<CategorySalesDto> salesByCategory = categoryAmountMap.entrySet().stream()
                .map(e -> new CategorySalesDto(
                        e.getKey(),
                        e.getValue().setScale(2, RoundingMode.HALF_UP),
                        categoryUnitsMap.getOrDefault(e.getKey(), 0L)
                ))
                .sorted(Comparator.comparing(CategorySalesDto::totalAmount, Comparator.reverseOrder()))
                .toList();

        // 6. Time-Series: Daily Sales
        List<SalesTimelinePointDto> dailySales = buildDailySales(periodValidOrders, safeDays);

        // 7. Time-Series: Weekly Sales
        List<SalesTimelinePointDto> weeklySales = buildWeeklySales(allOrders);

        // 8. Time-Series: Monthly & Annual Sales
        List<SalesTimelinePointDto> monthlySales = buildMonthlySales(allOrders);

        // 9. Operational Breakdown: Delivery vs Pickup
        List<DistributionMetricDto> deliveryMethodDistribution = buildDeliveryDistribution(periodValidOrders);

        // 10. Tax & Fiscal Breakdown: Factura vs Boleta
        List<DistributionMetricDto> invoiceTypeDistribution = buildInvoiceDistribution(periodValidOrders);

        // 11. Weekday Activity Analysis: Lunes a Domingo
        List<WeekdaySalesDto> weekdaySales = buildWeekdaySales(periodValidOrders);

        return new DashboardAnalyticsResponse(
                kpis,
                salespersonRanking,
                highRotationParts,
                lowRotationParts,
                salesByCategory,
                dailySales,
                weeklySales,
                monthlySales,
                deliveryMethodDistribution,
                invoiceTypeDistribution,
                weekdaySales
        );
    }

    private List<SalesTimelinePointDto> buildDailySales(List<CustomerOrder> orders, int days) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        DateTimeFormatter keyFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        DateTimeFormatter labelFmt = DateTimeFormatter.ofPattern("dd MMM", new Locale("es", "PE"));
        DateTimeFormatter subFmt = DateTimeFormatter.ofPattern("EEE", new Locale("es", "PE"));

        Map<String, BigDecimal> daySales = new HashMap<>();
        Map<String, BigDecimal> dayProfit = new HashMap<>();
        Map<String, Long> dayOrders = new HashMap<>();
        Map<String, Long> dayUnits = new HashMap<>();

        for (CustomerOrder o : orders) {
            LocalDate d = LocalDate.ofInstant(o.getCreatedAt(), ZoneOffset.UTC);
            String k = d.format(keyFmt);
            daySales.merge(k, o.getTotalAmount(), BigDecimal::add);
            dayOrders.merge(k, 1L, Long::sum);

            BigDecimal profit = o.getItems().stream()
                    .map(it -> it.getUnitSalePrice().subtract(it.getUnitPurchaseCost()).multiply(BigDecimal.valueOf(it.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            dayProfit.merge(k, profit, BigDecimal::add);

            long u = o.getItems().stream().mapToLong(OrderItem::getQuantity).sum();
            dayUnits.merge(k, u, Long::sum);
        }

        int pointsCount = Math.min(days, 30);
        List<SalesTimelinePointDto> result = new ArrayList<>();
        for (int i = pointsCount - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            String k = date.format(keyFmt);
            BigDecimal s = daySales.getOrDefault(k, BigDecimal.ZERO);
            BigDecimal p = dayProfit.getOrDefault(k, BigDecimal.ZERO);
            long oCount = dayOrders.getOrDefault(k, 0L);
            long uCount = dayUnits.getOrDefault(k, 0L);

            result.add(new SalesTimelinePointDto(
                    k,
                    date.format(labelFmt),
                    date.format(subFmt).toUpperCase(),
                    s.setScale(2, RoundingMode.HALF_UP),
                    p.setScale(2, RoundingMode.HALF_UP),
                    oCount,
                    uCount
            ));
        }
        return result;
    }

    private List<SalesTimelinePointDto> buildWeeklySales(List<CustomerOrder> allOrders) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        DateTimeFormatter lblFmt = DateTimeFormatter.ofPattern("dd/MM");

        List<SalesTimelinePointDto> weeks = new ArrayList<>();
        for (int i = 7; i >= 0; i--) {
            LocalDate weekEnd = today.minusWeeks(i).with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
            LocalDate weekStart = weekEnd.minusDays(6);

            Instant startInst = weekStart.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant endInst = weekEnd.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

            List<CustomerOrder> wOrders = allOrders.stream()
                    .filter(o -> o.getStatus() != OrderStatus.CANCELADO)
                    .filter(o -> !o.getCreatedAt().isBefore(startInst) && o.getCreatedAt().isBefore(endInst))
                    .toList();

            BigDecimal wSales = wOrders.stream().map(CustomerOrder::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            long oCount = wOrders.size();
            long uCount = wOrders.stream().flatMap(o -> o.getItems().stream()).mapToLong(OrderItem::getQuantity).sum();
            BigDecimal wProfit = wOrders.stream()
                    .flatMap(o -> o.getItems().stream())
                    .map(it -> it.getUnitSalePrice().subtract(it.getUnitPurchaseCost()).multiply(BigDecimal.valueOf(it.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            weeks.add(new SalesTimelinePointDto(
                    "W" + (8 - i),
                    "Semana " + (8 - i),
                    weekStart.format(lblFmt) + " - " + weekEnd.format(lblFmt),
                    wSales.setScale(2, RoundingMode.HALF_UP),
                    wProfit.setScale(2, RoundingMode.HALF_UP),
                    oCount,
                    uCount
            ));
        }
        return weeks;
    }

    private List<SalesTimelinePointDto> buildMonthlySales(List<CustomerOrder> allOrders) {
        int currentYear = LocalDate.now(ZoneOffset.UTC).getYear();
        String[] monthNames = {"Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"};

        Map<Integer, BigDecimal> monthSales = new HashMap<>();
        Map<Integer, BigDecimal> monthProfit = new HashMap<>();
        Map<Integer, Long> monthOrders = new HashMap<>();
        Map<Integer, Long> monthUnits = new HashMap<>();

        for (CustomerOrder o : allOrders) {
            if (o.getStatus() == OrderStatus.CANCELADO) continue;
            LocalDate ld = LocalDate.ofInstant(o.getCreatedAt(), ZoneOffset.UTC);
            if (ld.getYear() == currentYear) {
                int m = ld.getMonthValue();
                monthSales.merge(m, o.getTotalAmount(), BigDecimal::add);
                monthOrders.merge(m, 1L, Long::sum);

                BigDecimal p = o.getItems().stream()
                        .map(it -> it.getUnitSalePrice().subtract(it.getUnitPurchaseCost()).multiply(BigDecimal.valueOf(it.getQuantity())))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                monthProfit.merge(m, p, BigDecimal::add);

                long u = o.getItems().stream().mapToLong(OrderItem::getQuantity).sum();
                monthUnits.merge(m, u, Long::sum);
            }
        }

        List<SalesTimelinePointDto> months = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            String mName = monthNames[m - 1];
            BigDecimal s = monthSales.getOrDefault(m, BigDecimal.ZERO);
            BigDecimal profit = monthProfit.getOrDefault(m, BigDecimal.ZERO);
            long oCount = monthOrders.getOrDefault(m, 0L);
            long uCount = monthUnits.getOrDefault(m, 0L);

            months.add(new SalesTimelinePointDto(
                    String.format("%d-%02d", currentYear, m),
                    mName,
                    String.valueOf(currentYear),
                    s.setScale(2, RoundingMode.HALF_UP),
                    profit.setScale(2, RoundingMode.HALF_UP),
                    oCount,
                    uCount
            ));
        }
        return months;
    }

    private List<DistributionMetricDto> buildDeliveryDistribution(List<CustomerOrder> orders) {
        long deliveryCount = orders.stream().filter(o -> "DELIVERY".equalsIgnoreCase(o.getDeliveryType())).count();
        long pickupCount = orders.stream().filter(o -> !"DELIVERY".equalsIgnoreCase(o.getDeliveryType())).count();

        BigDecimal deliveryAmt = orders.stream()
                .filter(o -> "DELIVERY".equalsIgnoreCase(o.getDeliveryType()))
                .map(CustomerOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal pickupAmt = orders.stream()
                .filter(o -> !"DELIVERY".equalsIgnoreCase(o.getDeliveryType()))
                .map(CustomerOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long total = deliveryCount + pickupCount;
        double delivPct = total > 0
                ? BigDecimal.valueOf(deliveryCount * 100.0 / total).setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        double pickupPct = total > 0
                ? BigDecimal.valueOf(pickupCount * 100.0 / total).setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        return List.of(
                new DistributionMetricDto("DELIVERY", "Envío a Domicilio con Motorizado", deliveryAmt.setScale(2, RoundingMode.HALF_UP), deliveryCount, delivPct),
                new DistributionMetricDto("PICKUP", "Recojo en Tienda Central", pickupAmt.setScale(2, RoundingMode.HALF_UP), pickupCount, pickupPct)
        );
    }

    private List<DistributionMetricDto> buildInvoiceDistribution(List<CustomerOrder> orders) {
        long boletasCount = orders.stream().filter(o -> !"FACTURA".equalsIgnoreCase(o.getInvoiceType())).count();
        long facturasCount = orders.stream().filter(o -> "FACTURA".equalsIgnoreCase(o.getInvoiceType())).count();

        BigDecimal boletasAmt = orders.stream()
                .filter(o -> !"FACTURA".equalsIgnoreCase(o.getInvoiceType()))
                .map(CustomerOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal facturasAmt = orders.stream()
                .filter(o -> "FACTURA".equalsIgnoreCase(o.getInvoiceType()))
                .map(CustomerOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long total = boletasCount + facturasCount;
        double bolPct = total > 0
                ? BigDecimal.valueOf(boletasCount * 100.0 / total).setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        double facPct = total > 0
                ? BigDecimal.valueOf(facturasCount * 100.0 / total).setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        return List.of(
                new DistributionMetricDto("BOLETA", "Boletas de Venta (DNI / Personas)", boletasAmt.setScale(2, RoundingMode.HALF_UP), boletasCount, bolPct),
                new DistributionMetricDto("FACTURA", "Facturas Comerciales (RUC / Empresas)", facturasAmt.setScale(2, RoundingMode.HALF_UP), facturasCount, facPct)
        );
    }

    private List<WeekdaySalesDto> buildWeekdaySales(List<CustomerOrder> orders) {
        String[] daysEs = {"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"};
        Map<Integer, BigDecimal> amtMap = new HashMap<>();
        Map<Integer, Long> countMap = new HashMap<>();

        for (CustomerOrder o : orders) {
            LocalDate d = LocalDate.ofInstant(o.getCreatedAt(), ZoneOffset.UTC);
            int dow = d.getDayOfWeek().getValue();
            amtMap.merge(dow, o.getTotalAmount(), BigDecimal::add);
            countMap.merge(dow, 1L, Long::sum);
        }

        BigDecimal total = amtMap.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        List<WeekdaySalesDto> result = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            BigDecimal amt = amtMap.getOrDefault(i, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            long c = countMap.getOrDefault(i, 0L);
            double share = total.compareTo(BigDecimal.ZERO) > 0
                    ? amt.multiply(BigDecimal.valueOf(100.0)).divide(total, 1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;
            result.add(new WeekdaySalesDto(i, daysEs[i - 1], amt, c, share));
        }
        return result;
    }
}

package com.asuncion.erp.controller;

import com.asuncion.erp.dto.DriverReviewDto;
import com.asuncion.erp.service.DriverReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/driver-reviews")
public class DriverReviewController {

    private final DriverReviewService reviewService;

    public DriverReviewController(DriverReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public ResponseEntity<List<DriverReviewDto>> getAllReviews() {
        return ResponseEntity.ok(reviewService.getAllReviews());
    }

    @PostMapping
    public ResponseEntity<DriverReviewDto> submitReview(@RequestBody DriverReviewDto review) {
        return ResponseEntity.ok(reviewService.submitReview(review));
    }
}

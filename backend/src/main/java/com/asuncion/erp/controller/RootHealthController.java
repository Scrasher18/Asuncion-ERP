package com.asuncion.erp.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class RootHealthController {

    @RequestMapping(value = "/", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<Map<String, Object>> rootHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Autopartes Asunción ERP & E-Commerce API",
                "timestamp", Instant.now().toString()
        ));
    }

    @GetMapping("/favicon.ico")
    public ResponseEntity<Void> favicon() {
        return ResponseEntity.noContent().build();
    }
}

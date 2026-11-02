package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "manufacturer_brands")
public class ManufacturerBrand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "country_origin", length = 80)
    private String countryOrigin;

    public ManufacturerBrand() {
    }

    public ManufacturerBrand(String name, String countryOrigin) {
        this.name = name;
        this.countryOrigin = countryOrigin;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCountryOrigin() {
        return countryOrigin;
    }

    public void setCountryOrigin(String countryOrigin) {
        this.countryOrigin = countryOrigin;
    }
}

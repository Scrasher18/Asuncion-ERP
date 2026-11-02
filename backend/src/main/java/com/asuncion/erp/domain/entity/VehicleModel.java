package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;

@Entity
@Table(
        name = "vehicle_models",
        uniqueConstraints = @UniqueConstraint(name = "uq_vehicle_make_model", columnNames = {"make_id", "name"})
)
public class VehicleModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "make_id", nullable = false)
    private VehicleMake make;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "vehicle_type", nullable = false, length = 50)
    private String vehicleType;

    public VehicleModel() {
    }

    public VehicleModel(VehicleMake make, String name, String vehicleType) {
        this.make = make;
        this.name = name;
        this.vehicleType = vehicleType;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public VehicleMake getMake() {
        return make;
    }

    public void setMake(VehicleMake make) {
        this.make = make;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVehicleType() {
        return vehicleType;
    }

    public void setVehicleType(String vehicleType) {
        this.vehicleType = vehicleType;
    }
}

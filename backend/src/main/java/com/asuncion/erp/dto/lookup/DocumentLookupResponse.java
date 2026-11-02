package com.asuncion.erp.dto.lookup;

public record DocumentLookupResponse(
        boolean found,
        String documentType,
        String documentNumber,
        String fullName,
        String firstName,
        String lastName,
        String businessName,
        String fiscalAddress,
        String district,
        String province,
        String department,
        String taxStatus,
        String taxCondition,
        String source
) {
}

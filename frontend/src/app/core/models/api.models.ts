export type RoleName = 'ADMIN' | 'VENDEDOR' | 'MOTORIZADO' | 'CLIENTE';

export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  roles: string[];
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfile;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  recaptchaToken?: string;
}

export interface DemoAccount {
  role: RoleName;
  badgeColor: string;
  title: string;
  fullName: string;
  email: string;
  password: string;
  targetRoute: string;
  description: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export interface VehicleMake {
  id: number;
  name: string;
}

export interface VehicleModel {
  id: number;
  makeId: number;
  makeName?: string;
  name: string;
  vehicleType?: string;
}

export interface PartImage {
  id: number;
  imageUrl: string;
  primary?: boolean;
  isPrimary?: boolean;
  sortOrder?: number;
  displayOrder?: number;
  format?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  originalSizeBytes?: number;
  width?: number;
  height?: number;
}

export interface PartCompatibility {
  id?: number;
  modelId: number;
  makeId?: number;
  makeName?: string;
  modelName?: string;
  vehicleType?: string;
  yearStart: number;
  yearEnd: number;
  engineSpec?: string;
  notes?: string;
}

export interface Part {
  id: number;
  sku: string;
  oemCode?: string | null;
  name: string;
  technicalDescription?: string;
  manufacturerBrand?: string;
  categoryId: number;
  categoryName?: string;
  purchasePrice?: number;
  salePrice: number;
  wholesalePrice?: number | null;
  stockQuantity: number;
  reservedQuantity?: number;
  availableStock?: number;
  minStockLevel?: number;
  lowStockAlert?: boolean;
  active?: boolean;
  primaryImageUrl?: string | null;
  images?: PartImage[];
  compatibilities?: PartCompatibility[];
}

export interface PartCompatibilityInput {
  modelId: number;
  yearStart: number;
  yearEnd: number;
  engineSpec?: string;
  notes?: string;
}

export interface PartUpsertRequest {
  sku?: string;
  oemCode?: string;
  name: string;
  technicalDescription: string;
  manufacturerBrand: string;
  categoryId: number;
  purchasePrice: number;
  salePrice: number;
  wholesalePrice?: number | null;
  stockQuantity: number;
  minStockLevel: number;
  active: boolean;
  compatibilities: PartCompatibilityInput[];
}

export interface PartAutocompleteSuggestion {
  name: string;
  manufacturerBrand: string;
  categoryCode: string;
  oemCode?: string;
  technicalDescription: string;
  suggestedPurchasePrice: number;
  suggestedSalePrice: number;
  suggestedWholesalePrice: number;
  commonVehicles: string[];
}

export interface VehicleModelSuggestion {
  name: string;
  vehicleType: string;
}

export interface VehicleQuickImportRequest {
  makeName: string;
  models: VehicleModelSuggestion[];
}

export interface DocumentLookupResponse {
  found: boolean;
  documentType: 'DNI' | 'RUC';
  documentNumber: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  businessName: string | null;
  fiscalAddress?: string;
  district?: string;
  province?: string;
  department?: string;
  taxStatus?: string;
  taxCondition?: string;
  source?: string;
}

export interface AddressLookupSuggestion {
  displayName: string;
  district: string;
  latitude: number;
  longitude: number;
}

export interface MailConfigResponse {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  username: string;
  hasPassword?: boolean;
  fromName: string;
  adminNotificationEmail: string;
}

export interface MailConfigUpdateRequest {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password?: string;
  fromName: string;
  adminNotificationEmail: string;
}

export interface MailTestResponse {
  success: boolean;
  status: string;
  message: string;
}

export type NotificationDeliveryStatus = 'SENT' | 'SIMULATED_NO_SMTP' | 'FAILED';

export interface NotificationLogItem {
  id: number;
  eventType: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  orderNumber?: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  errorMessage?: string | null;
  createdAt: string;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  coverageRadiusMeters: number;
  baseDeliveryFee: number;
  perKmFee?: number;
  active: boolean;
}

export interface CoverageValidationRequest {
  latitude: number;
  longitude: number;
  branchId: number;
}

export interface CoverageValidationResponse {
  covered: boolean;
  branchId: number;
  branchName: string;
  branchLatitude: number;
  branchLongitude: number;
  customerLatitude: number;
  customerLongitude: number;
  distanceMeters: number;
  allowedRadiusMeters: number;
  estimatedDeliveryFee: number;
  validationEngine?: string;
  message: string;
}

export interface CartItem {
  part: Part;
  quantity: number;
}

export type DeliveryType = 'DELIVERY' | 'PICKUP' | 'MOSTRADOR';
export type InvoiceType = 'BOLETA' | 'FACTURA';

export interface CreateOrderItemInput {
  partId: number;
  quantity: number;
}

export interface CustomComboPair {
  mainPartId: number;
  complementPartId: number;
  discountPercent?: number;
}

export interface CreateOrderRequest {
  branchId: number;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryReference?: string;
  deliverySecurityCode?: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  invoiceType: InvoiceType;
  customerTaxId?: string;
  billingDocumentNumber?: string;
  customerBusinessName?: string;
  billingBusinessName?: string;
  recipientName: string;
  recipientPhone: string;
  paymentMethod: string;
  notes?: string;
  reservationSessionId?: string;
  items: CreateOrderItemInput[];
  customCombos?: CustomComboPair[];
}

export interface ReservedItemStatusDto {
  partId: number;
  sku: string;
  name: string;
  requestedQuantity: number;
  reservedQuantity: number;
  physicalStock: number;
  reservedByOthers: number;
  availableForYou: number;
  status: 'RESERVADO' | 'AJUSTADO_POR_RESERVA' | 'AGOTADO_EN_RESERVA' | 'AGOTADO';
  message: string;
}

export interface ReservationSyncResponse {
  sessionId: string;
  expiresAt: string;
  ttlSeconds: number;
  items: ReservedItemStatusDto[];
}

export interface OrderItem {
  id: number;
  partId: number;
  partSku?: string;
  sku?: string;
  partOemCode?: string;
  oemCode?: string;
  partName?: string;
  name?: string;
  manufacturerBrand?: string;
  primaryImageUrl?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  lineTotal?: number;
  picked?: boolean;
  pickedAt?: string;
}

export interface OrderStatusHistory {
  id?: number;
  status?: string;
  newStatus?: string;
  previousStatus?: string;
  notes?: string;
  comment?: string;
  comments?: string;
  changedBy?: string;
  changedByName?: string;
  createdAt?: string;
  changedAt?: string;
  timestamp?: string;
}

export interface DeliveryProof {
  id?: number;
  evidenceImageUrl?: string;
  imageUrl?: string;
  receiverName: string;
  receiverDocument?: string;
  deliveryNotes?: string;
  notes?: string;
  capturedLatitude?: number;
  capturedLongitude?: number;
  deliveredAt?: string;
  createdAt?: string;
  driverName?: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: string;
  branchId: number;
  branchName?: string;
  branchAddress?: string;
  branchLatitude?: number;
  branchLongitude?: number;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  salespersonId?: number;
  salespersonName?: string;
  assignedDriverId?: number;
  assignedDriverName?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryReference?: string;
  deliverySecurityCode?: string;
  proximityAlertSent?: boolean;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  distanceMeters?: number;
  calculatedDistanceMeters?: number;
  invoiceType: InvoiceType;
  customerTaxId?: string;
  billingDocumentNumber?: string;
  customerBusinessName?: string;
  billingBusinessName?: string;
  recipientName?: string;
  recipientPhone?: string;
  paymentMethod?: string;
  notes?: string;
  warehouseNotes?: string;
  subtotal: number;
  taxAmount?: number;
  igvAmount?: number;
  deliveryFee: number;
  totalAmount?: number;
  total?: number;
  items: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  deliveryProof?: DeliveryProof | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ReadyForDispatchRequest {
  assignedDriverId?: number | null;
  warehouseNotes?: string;
}

export type DriverStatus = 'DISPONIBLE' | 'EN_RUTA' | 'RETORNANDO' | 'FUERA_DE_TURNO';

export interface DriverSummary {
  id: number;
  fullName: string;
  email?: string;
  phone?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  documentNumber?: string;
  status?: DriverStatus;
  activeOrderNumber?: string;
  activeDeliveries?: number;
}

export interface DashboardKpis {
  totalRevenue?: number;
  totalSales?: number;
  totalOrders?: number;
  completedOrders?: number;
  deliveredOrders?: number;
  averageTicket?: number;
  activeParts?: number;
  totalParts?: number;
  lowStockCount?: number;
  lowStockPartsCount?: number;
  inventoryValuation?: number;
  totalInventoryValue?: number;
  periodDays?: number;
}

export interface SalespersonMetric {
  userId?: number;
  salespersonId?: number;
  fullName?: string;
  salespersonName?: string;
  name?: string;
  email?: string;
  totalSales?: number;
  totalSalesVolume?: number;
  totalRevenue?: number;
  closedTransactions?: number;
  transactionsCount?: number;
  ordersCount?: number;
  monthlyQuota?: number;
  salesQuota?: number;
  quotaAmount?: number;
  quotaAchievementPercent?: number;
  quotaProgressPercent?: number;
  goalCompletionPercent?: number;
  averageTicket?: number;
  rankPosition?: number;
}

export interface PartRotationMetric {
  partId?: number;
  id?: number;
  sku: string;
  oemCode?: string | null;
  name?: string;
  partName?: string;
  categoryName?: string;
  manufacturerBrand?: string;
  unitsSold?: number;
  totalUnitsSold?: number;
  revenue?: number;
  revenueGenerated?: number;
  totalRevenue?: number;
  immobilizedCapital?: number;
  currentStock?: number;
  stockQuantity?: number;
  minStockLevel?: number;
  daysSinceLastSale?: number | null;
  rotationRate?: number;
  turnoverRatio?: number;
  turnoverIndex?: number;
  rotationStatus?: string;
}

export interface CategorySalesMetric {
  categoryId?: number;
  categoryCode?: string;
  code?: string;
  categoryName?: string;
  name?: string;
  totalRevenue?: number;
  totalAmount?: number;
  revenue?: number;
  unitsSold?: number;
  ordersCount?: number;
  sharePercent?: number;
  percentage?: number;
}

export interface SalesTimelinePoint {
  periodKey: string;
  label: string;
  subLabel?: string;
  totalSales: number;
  grossProfit?: number;
  ordersCount: number;
  unitsSold: number;
}

export interface DistributionMetric {
  key: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface WeekdaySalesMetric {
  dayOfWeek: number;
  dayName: string;
  totalAmount: number;
  ordersCount: number;
  sharePercent: number;
}

export interface ExecutiveDashboardResponse {
  kpis: DashboardKpis;
  salespersonRanking: SalespersonMetric[];
  highRotationParts: PartRotationMetric[];
  lowRotationParts: PartRotationMetric[];
  salesByCategory: CategorySalesMetric[];
  dailySales?: SalesTimelinePoint[];
  weeklySales?: SalesTimelinePoint[];
  monthlySales?: SalesTimelinePoint[];
  deliveryMethodDistribution?: DistributionMetric[];
  invoiceTypeDistribution?: DistributionMetric[];
  weekdaySales?: WeekdaySalesMetric[];
}

export interface ChatbotRequest {
  message: string;
  sessionId: string;
}

export interface ChatbotResponse {
  reply: string;
  intent?: string;
  engineUsed?: string;
  suggestedParts?: Part[];
  trackedOrder?: Order | null;
  quickReplies?: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

/**
 * Computes spherical Haversine distance in meters between two WGS84 coordinates.
 * Mirrors PostGIS ST_Distance(geography, geography) on the client side.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371008.8; // IUGG mean Earth radius in meters (matches PostGIS sphere)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Generates an inline data-URI SVG placeholder tailored to a spare part's SKU/Brand.
 */
export function buildPartPlaceholderDataUri(label = 'OEM', brand = 'Asunción'): string {
  const safeLabel = label.replace(/[<>&"']/g, '').slice(0, 18);
  const safeBrand = brand.replace(/[<>&"']/g, '').slice(0, 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
    <rect width="600" height="450" fill="#F9FAFB"/>
    <rect x="24" y="24" width="552" height="402" rx="16" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1.5"/>
    <circle cx="300" cy="188" r="78" fill="#FFF7ED" stroke="#FDBA74" stroke-width="2" stroke-dasharray="10 6"/>
    <circle cx="300" cy="188" r="52" fill="#FFFFFF" stroke="#EA580C" stroke-width="3"/>
    <circle cx="300" cy="188" r="18" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="2"/>
    <circle cx="300" cy="152" r="4" fill="#EA580C"/>
    <circle cx="336" cy="188" r="4" fill="#EA580C"/>
    <circle cx="300" cy="224" r="4" fill="#EA580C"/>
    <circle cx="264" cy="188" r="4" fill="#EA580C"/>
    <text x="300" y="320" text-anchor="middle" fill="#111827" font-family="ui-monospace, monospace" font-size="20" font-weight="600">${safeLabel}</text>
    <text x="300" y="348" text-anchor="middle" fill="#6B7280" font-family="system-ui, sans-serif" font-size="14" font-weight="500">${safeBrand} · Repuesto Automotriz</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface AdminUserResponse {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  role: string;
  roles: string[];
  active: boolean;
  driverStatus?: string;
  employeeCode?: string;
  licenseNumber?: string;
  vehiclePlate?: string;
  createdAt?: string;
}

export interface CreateStaffUserRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  role: string;
  employeeCode?: string;
  licenseNumber?: string;
  vehiclePlate?: string;
}

export interface UpdateStaffUserRequest {
  fullName: string;
  email: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  role: string;
  active?: boolean;
  newPassword?: string;
  employeeCode?: string;
  licenseNumber?: string;
  vehiclePlate?: string;
}

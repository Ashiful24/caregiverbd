/**
 * API Service - Centralized API endpoints
 * Based on: hope-backend/api_business_flow.md
 * Base URL: /v1 (from VITE_API_BASE_URL)
 */

import httpService from "./httpService";

// ============== Auth & Login ==============

export interface LoginRequest {
  identifier: string; // Email or Bangladeshi mobile
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  providerType?: string;
  providerCategory?: string;
  employmentType?: string;
}

/** POST /v1/auth/refresh - body and response (per api_business_flow §2.2) */
export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ============== OTP & Registration ==============

export interface OtpRequestRequest {
  mobileNumber: string; // 01XXXXXXXXX, +880..., or 880...
}

export interface OtpVerifyRequest {
  mobileNumber: string;
  otpCode: string;
}

export interface OtpVerifyResponse {
  verificationToken: string;
}

export interface RegisterProviderRequest {
  verificationToken: string;
  mobileNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  bmdcNumber: string;
  experience: number;
  consultationTypeId: number;
}

export interface RegisterPatientRequest {
  verificationToken: string;
  mobileNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  nidNumber: string;
}

// ============== Forgot Password ==============

export interface PasswordResetRequestRequest {
  identifier: string; // Email or phone
}

export interface PasswordResetVerifyOtpRequest {
  mobileNumber: string;
  otpCode: string;
}

export interface PasswordResetVerifyOtpResponse {
  verificationToken: string;
}

export interface PasswordResetRequest {
  mobileNumber: string;
  verificationToken: string;
  newPassword: string;
}

// ============== Consultation & Providers ==============

/** Matches backend consultation_types response (camelCase from API) */
export interface ConsultationType {
  id: number;
  name: string;
  description?: string | null;
  code?: string | null;
  parentId?: number | null;
  employmentType?: string | null;
  /** Optional platform commission percent (0–100) configured for this type. */
  platformCommissionPercent?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  deletedBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  children?: ConsultationType[];
}

export interface ProviderSearchRequest {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  consultationTypeId?: number[];
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  page?: number;
  limit?: number;
}

/** POST /providers/:providerId/search - body (all optional): date, time, latitude, longitude */
export interface SingleProviderSearchRequest {
  date?: string;
  time?: string;
  latitude?: number;
  longitude?: number;
}

export interface ScheduleSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
}

export interface ProviderSearchResult {
  id: number;
  userId: number;
  consultationTypeId: number;
  bmdcNumber?: string;
  experience?: number;
  isVerified: boolean;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: string;
  providerName: string;
  currentFee?: number;
  feeType?: "CONSULTATION" | "HOURLY";
  distance?: number;
  availableSlots?: ScheduleSlot[];
}

/** GET /patients/me/liked-providers - item shape. PATIENT only. */
export interface LikedProviderItemDto {
  providerId: number;
  userId: number;
  providerName: string;
  consultationTypeId: number;
  consultationTypeName: string;
  currentFee?: number;
  feeType?: string;
  profilePicture?: string | null;
  averageRating?: number;
  totalReviews?: number;
  likedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    radiusKm?: number;
  };
}

export interface BillingRateRequest {
  amount: number;
  type?: "CONSULTATION" | "HOURLY";
}

export interface BillingRateHistoryResponse {
  currentRate: { id: number; amount: number; type: string; validFrom: string; validTo: null };
  history: Array<{ id: number; amount: number; type: string; validFrom: string; validTo: string }>;
}

// ============== Service Requests ==============

export interface CreateServiceRequestRequest {
  consultationTypeId: number;
  latitude: number;
  longitude: number;
  providerId?: number;
  description?: string;
  scheduledAt?: string; // ISO 8601
  scheduleSlotId?: number;
}

export interface ServiceRequest {
  id: number;
  patientId: number;
  providerId?: number;
  consultationTypeId: number;
  status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  fee?: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RejectRequestInput {
  reason?: string;
}

// ============== Provider Schedule ==============

export interface ScheduleSlotInput {
  id?: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

// ============== Patient Vitals ==============

export interface RecordVitalsRequest {
  recordedAt: string; // ISO 8601
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bloodSugar?: number;
  steps?: number;
  waterIntake?: number;
  metadata?: Record<string, unknown>;
}

// ============== Notifications ==============

export interface RegisterDeviceRequest {
  deviceId: string;
  regToken: string;
  /** "android" | "ios" for mobile; "web" for browser push (FCM). */
  device: "android" | "ios" | "web";
  type?: string;
}

/** GET /notifications — list item. */
export interface NotificationHistoryItem {
  id: number;
  title: string;
  body: string;
  type: string;
  status: string;
  readAt: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

/** GET /notifications — meta. */
export interface NotificationHistoryMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount?: number;
}

/** GET /notifications — response. */
export interface NotificationHistoryListResponse {
  data: NotificationHistoryItem[];
  meta: NotificationHistoryMeta;
}

/** POST /notifications/test-push — send test push (e.g. admin). */
export interface TestPushRequest {
  userId: number;
  title?: string;
  body?: string;
}

// ============== Financial ==============

/** GET /financial/wallet/me — per api_business_flow §11. */
export interface WalletResponse {
  totalBalance: string;
  claimableBalance: string;
  nonClaimableBalance: string;
  cashCommissionDue: string;
  pendingWithdrawal: string;
}

export interface ClaimableBalanceResponse {
  total: number;
  breakdown?: Array<{ serviceRequestId: number; amount: number }>;
}

export interface ClaimBalanceRequest {
  amount?: number; // optional; if omitted, claim all
}

// ============== Verification Documents ==============

/** Single verification document (upload response or in list). */
export interface DocumentUploadResponse {
  id: number;
  userId?: number;
  type: string;
  filePath?: string;
  path?: string;
  status: string;
  adminComment?: string | null;
  createdAt: string;
}

/** One verification requirement with optional user upload (from GET /verification-documents). */
export interface VerificationRequirementWithUploadDto {
  id: number;
  documentType: string;
  isRequired: boolean;
  displayOrder: number;
  uploadedDocument: DocumentUploadResponse | null;
}

/** GET /verification-documents response. */
export interface DocumentsWithRequirementsResponseDto {
  consultationTypeId: number | null;
  consultationTypeName: string | null;
  requirements: VerificationRequirementWithUploadDto[];
  documents: DocumentUploadResponse[];
}

// ============== Auth API ==============

export const authApi = {
  login: async (data: LoginRequest) => {
    return httpService.requestWithoutAuth<LoginResponse>("POST", "/users/login", data);
  },

  logout: async () => {
    return httpService.post("/users/logout");
  },

  /** POST /v1/auth/refresh - no auth header; uses refreshToken in body. Returns new access + refresh (rotation). */
  refresh: async (refreshToken: string) => {
    return httpService.requestWithoutAuth<RefreshResponse>("POST", "/auth/refresh", {
      refreshToken,
    });
  },

  updatePassword: async (data: UpdatePasswordRequest) => {
    return httpService.put<{ message: string }>("/users/profile/password", data);
  },

  /** POST /auth/otp/request - Request OTP for registration */
  otpRequest: async (data: OtpRequestRequest) => {
    return httpService.requestWithoutAuth<{ message: string }>("POST", "/auth/otp/request", data);
  },

  /** POST /auth/otp/verify - Verify OTP, returns verificationToken */
  otpVerify: async (data: OtpVerifyRequest) => {
    return httpService.requestWithoutAuth<OtpVerifyResponse>("POST", "/auth/otp/verify", data);
  },

  /** POST /auth/register/provider */
  registerProvider: async (data: RegisterProviderRequest) => {
    return httpService.requestWithoutAuth<{ user: LoginResponse["user"] }>(
      "POST",
      "/auth/register/provider",
      data
    );
  },

  /** POST /auth/register/patient */
  registerPatient: async (data: RegisterPatientRequest) => {
    return httpService.requestWithoutAuth<{ user: LoginResponse["user"] }>(
      "POST",
      "/auth/register/patient",
      data
    );
  },

  /** POST /auth/password-reset/request */
  passwordResetRequest: async (data: PasswordResetRequestRequest) => {
    return httpService.requestWithoutAuth<{ message: string }>(
      "POST",
      "/auth/password-reset/request",
      data
    );
  },

  /** POST /auth/password-reset/verify-otp */
  passwordResetVerifyOtp: async (data: PasswordResetVerifyOtpRequest) => {
    return httpService.requestWithoutAuth<PasswordResetVerifyOtpResponse>(
      "POST",
      "/auth/password-reset/verify-otp",
      data
    );
  },

  /** POST /auth/password-reset/reset */
  passwordReset: async (data: PasswordResetRequest) => {
    return httpService.requestWithoutAuth<{ message: string }>(
      "POST",
      "/auth/password-reset/reset",
      data
    );
  },
};

// ============== Consultation Types API ==============

/** Payload for creating a consultation type (admin). */
export interface CreateConsultationTypeRequest {
  name: string;
  description?: string;
  code?: string;
  employmentType?: string;
  parentId?: number;
  /** Optional platform commission percent (0–100) for this type. */
  platformCommissionPercent?: number;
}

/** Payload for updating a consultation type (admin). */
export interface UpdateConsultationTypeRequest {
  name: string;
  description?: string;
  code?: string | null;
  employmentType?: string | null;
  parentId?: number | null;
  priority?: number;
  /** Optional platform commission percent (0–100) for this type. */
  platformCommissionPercent?: number | null;
}

/** Payload for reordering consultation types (siblings under same parent). */
export interface ReorderConsultationTypesRequest {
  parentId: number | null;
  orderedIds: number[];
}

export const consultationTypesApi = {
  /** GET /consultation-types - Hierarchical tree. Optional code returns single-root subtree or 404. */
  getAll: async (code?: string) => {
    const params = code?.trim() ? { code: code.trim() } : undefined;
    return httpService.get<ConsultationType[] | ConsultationType>("/consultation-types", params ? { params } : undefined);
  },

  /** POST /admin/consultation-types - Create (root or child). Backend may not exist yet. */
  create: async (data: CreateConsultationTypeRequest) => {
    return httpService.post<ConsultationType>("/admin/consultation-types", data);
  },

  /** PATCH /admin/consultation-types/:id - Update name. Backend may not exist yet. */
  update: async (id: number, data: UpdateConsultationTypeRequest) => {
    return httpService.patch<ConsultationType>(`/admin/consultation-types/${id}`, data);
  },

  /** DELETE /admin/consultation-types/:id - Delete (may fail if in use). Backend may not exist yet. */
  delete: async (id: number) => {
    return httpService.delete(`/admin/consultation-types/${id}`);
  },

  /** POST /admin/consultation-types/reorder - Reorder siblings. Backend may not exist yet. */
  reorder: async (data: ReorderConsultationTypesRequest) => {
    return httpService.post<ConsultationType[]>("/admin/consultation-types/reorder", data);
  },

  // --- Admin: Checklist services per consultation type ---
  /** GET /admin/consultation-types/:id/services */
  getServices: async (consultationTypeId: number) => {
    return httpService.get<ConsultationTypeServiceItem[]>(
      `/admin/consultation-types/${consultationTypeId}/services`
    );
  },
  /** POST /admin/consultation-types/:id/services */
  createService: async (
    consultationTypeId: number,
    data: { label: string; displayOrder?: number }
  ) => {
    return httpService.post<ConsultationTypeServiceItem>(
      `/admin/consultation-types/${consultationTypeId}/services`,
      data
    );
  },
  /** PATCH /admin/consultation-types/:id/services/:serviceId */
  updateService: async (
    consultationTypeId: number,
    serviceId: number,
    data: { label?: string; displayOrder?: number }
  ) => {
    return httpService.patch<ConsultationTypeServiceItem>(
      `/admin/consultation-types/${consultationTypeId}/services/${serviceId}`,
      data
    );
  },
  /** DELETE /admin/consultation-types/:id/services/:serviceId */
  deleteService: async (consultationTypeId: number, serviceId: number) => {
    return httpService.delete(
      `/admin/consultation-types/${consultationTypeId}/services/${serviceId}`
    );
  },

  // --- Admin: Verification requirements per consultation type ---
  /** GET /admin/consultation-types/:id/verification-requirements */
  getVerificationRequirements: async (consultationTypeId: number) => {
    return httpService.get<ConsultationTypeVerificationRequirementItem[]>(
      `/admin/consultation-types/${consultationTypeId}/verification-requirements`
    );
  },
  /** POST /admin/consultation-types/:id/verification-requirements */
  createVerificationRequirement: async (
    consultationTypeId: number,
    data: { documentType: string; isRequired?: boolean; displayOrder?: number }
  ) => {
    return httpService.post<ConsultationTypeVerificationRequirementItem>(
      `/admin/consultation-types/${consultationTypeId}/verification-requirements`,
      data
    );
  },
  /** PATCH /admin/consultation-types/:id/verification-requirements/:reqId */
  updateVerificationRequirement: async (
    consultationTypeId: number,
    reqId: number,
    data: { isRequired?: boolean; displayOrder?: number }
  ) => {
    return httpService.patch<ConsultationTypeVerificationRequirementItem>(
      `/admin/consultation-types/${consultationTypeId}/verification-requirements/${reqId}`,
      data
    );
  },
  /** DELETE /admin/consultation-types/:id/verification-requirements/:reqId */
  deleteVerificationRequirement: async (
    consultationTypeId: number,
    reqId: number
  ) => {
    return httpService.delete(
      `/admin/consultation-types/${consultationTypeId}/verification-requirements/${reqId}`
    );
  },
};

/** Checklist service item (consultation type services). */
export interface ConsultationTypeServiceItem {
  id: number;
  label: string;
  displayOrder: number;
}

/** Verification requirement item (admin). */
export interface ConsultationTypeVerificationRequirementItem {
  id: number;
  consultationTypeId: number;
  documentType: string;
  isRequired: boolean;
  displayOrder: number;
}

// ============== Admin: System Configuration ==============

/** Single system config entry (system_configs table). */
export interface SystemConfigItem {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string | null;
}

export const adminSystemConfigApi = {
  /** GET /admin/system-config — List all system config entries. */
  list: async () => {
    return httpService.get<SystemConfigItem[]>("/admin/system-config");
  },
  /** PATCH /admin/system-config/:key — Update value and optional description. */
  update: async (key: string, data: { value: string; description?: string | null }) => {
    return httpService.patch<SystemConfigItem>(`/admin/system-config/${encodeURIComponent(key)}`, data);
  },
};

// ============== Admin: Verification Document Types ==============

/** Admin-managed verification document type (add, update, deactivate). */
export interface VerificationDocumentTypeItem {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export const verificationDocumentTypesApi = {
  list: async (params?: { activeOnly?: boolean }) => {
    return httpService.get<VerificationDocumentTypeItem[]>(
      "/admin/verification-document-types",
      { params: params as Record<string, string> }
    );
  },
  create: async (data: { code: string; label: string; isActive?: boolean; displayOrder?: number }) => {
    return httpService.post<VerificationDocumentTypeItem>(
      "/admin/verification-document-types",
      data
    );
  },
  update: async (id: number, data: { label?: string; displayOrder?: number }) => {
    return httpService.patch<VerificationDocumentTypeItem>(
      `/admin/verification-document-types/${id}`,
      data
    );
  },
  setActive: async (id: number, isActive: boolean) => {
    return httpService.patch<VerificationDocumentTypeItem>(
      `/admin/verification-document-types/${id}/active`,
      { isActive }
    );
  },
};

// ============== Admin: Upgrade Requests ==============

export interface UpgradeRequestListItem {
  id: number;
  providerId: number;
  providerUserId: number;
  providerName: string | null;
  currentConsultationTypeId: number | null;
  currentConsultationTypeName: string | null;
  targetConsultationTypeId: number;
  targetConsultationTypeName: string | null;
  status: string;
  createdAt: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  adminComment: string | null;
}

export const upgradeRequestsApi = {
  /** GET /admin/upgrade-requests — List provider upgrade requests. Query: status (PENDING | APPROVED | REJECTED). */
  list: async (params?: { status?: "PENDING" | "APPROVED" | "REJECTED" }) => {
    return httpService.get<UpgradeRequestListItem[]>("/admin/upgrade-requests", {
      params: params as Record<string, string>,
    });
  },
  /** GET /admin/upgrade-requests/:id — Single upgrade request (for detail page). */
  getById: async (id: number) => {
    return httpService.get<UpgradeRequestListItem>(`/admin/upgrade-requests/${id}`);
  },
  /** PATCH /admin/upgrade-requests/:id — Approve or reject. */
  review: async (
    id: number,
    data: { status: "APPROVED" | "REJECTED"; adminComment?: string }
  ) => {
    return httpService.patch<{ message: string }>(`/admin/upgrade-requests/${id}`, data);
  },
};

// ============== Providers API ==============

/**
 * Admin provider list item (AdminProviderListDto).
 * GET /v1/admin/providers — providers table + users + consultation_types.
 * Status replaces previous isVerified: PENDING | ACTIVE | REJECTED | ARCHIVED.
 */
export type ProviderStatus = "PENDING" | "ACTIVE" | "REJECTED" | "ARCHIVED";

export interface ProviderListItem {
  id: number;
  userId: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bmdcNumber?: string;
  /** Backend may return string (e.g. "5 years") or number */
  experience?: number | string | null;
  /** Provider status (replaces isVerified). */
  status: ProviderStatus;
  consultationTypeId?: number | null;
  consultationTypeName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** Single document item (for provider documents block). */
export interface ProviderDocumentItem {
  id: number;
  type?: string;
  path?: string;
  url?: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** Response shape for GET /v1/admin/providers */
export interface AdminProviderListResponse {
  providers: ProviderListItem[];
  total: number;
  page: number;
  limit: number;
}

/** UI status filter for provider list. Sent to API as uppercase (PENDING, ACTIVE, REJECTED, DEACTIVATED, ARCHIVED). */
export type ProviderListStatusFilter = "all" | "pending" | "active" | "rejected" | "deactivated" | "archived";

// ============== Admin Full Details DTOs (GET .../details) ==============

/** Base user in admin full details (ProviderFullDetailsDto / PatientFullDetailsDto). */
export interface AdminUserDetailUserDto {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  /** Profile picture URL when available. */
  profilePicture?: string | null;
  /** Gender for placeholder avatar when no profile picture: MALE, FEMALE, or other. */
  gender?: string | null;
}

/** Full provider profile in ProviderFullDetailsDto. */
export interface ProviderFullProfileDto {
  id: number;
  userId: number;
  bmdcNumber: string;
  experience?: string | null;
  status: string;
  consultationTypeId?: number | null;
  consultationTypeName?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  serviceRadiusKm?: string | null;
  createdAt: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

/** Full patient profile in PatientFullDetailsDto. */
export interface PatientFullProfileDto {
  id: number;
  userId: number;
  nidNumber: string;
  isFaceVerified: boolean;
  status: string;
  createdAt: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

/** Single service request in admin details (serviceRequestsByStatus). */
export interface AdminServiceRequestDto {
  id: number;
  patientId: number;
  providerId: number | null;
  consultationTypeId: number;
  scheduleSlotId?: number | null;
  status: string;
  latitude: string;
  longitude: string;
  description?: string | null;
  scheduledAt?: string | null;
  fee: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

/** Service requests grouped by status (PENDING, ACCEPTED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED). */
export interface ServiceRequestsByStatusDto {
  PENDING: AdminServiceRequestDto[];
  ACCEPTED: AdminServiceRequestDto[];
  REJECTED: AdminServiceRequestDto[];
  IN_PROGRESS: AdminServiceRequestDto[];
  COMPLETED: AdminServiceRequestDto[];
  CANCELLED: AdminServiceRequestDto[];
}

/** Wallet in admin full details. */
export interface AdminWalletDetailDto {
  id: number;
  balance: string;
  currency: string;
  createdAt: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

/** Wallet ledger entry in admin full details. */
export interface WalletHistoryEntryDto {
  id: number;
  transactionId: number;
  amount: string;
  balanceAfter: string;
  description?: string | null;
  createdAt: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

/** Location (lat/long) for admin service request detail. */
export interface AdminLocationDto {
  latitude: string;
  longitude: string;
}

/** Service request detail for admin: id, status, locations, distance, amount, patient/provider names. */
export interface AdminServiceRequestDetailDto {
  id: number;
  status: string;
  patientId: number;
  patientName?: string | null;
  providerId?: number | null;
  providerName?: string | null;
  consultationTypeId: number;
  consultationTypeName?: string | null;
  locationFrom?: AdminLocationDto | null;
  locationTo: AdminLocationDto;
  distanceKm?: number | null;
  amount: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

/** Service requests grouped by consultation type (GET .../service-requests). */
export interface ServiceDetailsByConsultationTypeEntryDto {
  consultationTypeId: number;
  consultationTypeName: string;
  requests: AdminServiceRequestDetailDto[];
}

/** Service request status for admin filter (PENDING, ACCEPTED, etc.). */
export type AdminServiceRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Single item in GET /v1/admin/service-requests list (api_business_flow §5c). */
export interface AdminServiceRequestListDto {
  id: number;
  status: string;
  patientId: number;
  patientName?: string | null;
  providerId?: number | null;
  providerName?: string | null;
  consultationTypeId: number;
  consultationTypeName?: string | null;
  amount: string;
  scheduledAt?: string | null;
  createdAt: string;
}

/** Response for GET /v1/admin/service-requests. */
export interface AdminServiceRequestListResponse {
  data: AdminServiceRequestListDto[];
  total: number;
  page: number;
  limit: number;
}

/** Certification item for a provider (per api_business_flow §4a/4b: GET .../certifications). */
export interface AdminCertificationDto {
  id: number;
  providerId: number;
  certificationTypeCode: string;
  certificationTypeName: string;
  certificationNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt?: string | null;
  /** Name of the admin who approved or rejected this certification. */
  approvedByName?: string | null;
  adminComment?: string | null;
  createdAt: string;
  /** URL or path to view the uploaded document for this certificate. */
  documentUrl?: string | null;
}

/** One consultation-type checklist service with offered flag (provider profile). */
export interface ProviderConsultationTypeServiceItemDto {
  id: number;
  label: string;
  displayOrder: number;
  /** True if provider offers this service; false if excluded. */
  offered: boolean;
}

/** Full provider details: GET /v1/admin/providers/:providerId/details. Wallet fields per api_business_flow §11. */
export interface ProviderFullDetailsDto {
  user: AdminUserDetailUserDto;
  provider: ProviderFullProfileDto;
  /** Checklist services for this provider's consultation type; offered = true means provider offers it. */
  consultationTypeServices?: ProviderConsultationTypeServiceItemDto[];
  serviceRequestsByStatus: ServiceRequestsByStatusDto;
  wallet?: AdminWalletDetailDto | null;
  /** Total wallet balance (new wallet API §11). */
  totalBalance?: string | null;
  claimableBalance: string;
  /** Non-claimable (cash) balance. */
  nonClaimableBalance?: string | null;
  /** Commission owed by provider for cash payments. */
  cashCommissionDue?: string | null;
  /** Pending withdrawal amount. */
  pendingWithdrawal?: string | null;
  walletHistory: WalletHistoryEntryDto[];
}

/** Single vitals record for display (e.g. in beneficiary or patient details). */
export interface VitalsEntryDto {
  id?: number;
  recordedAt: string;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  bloodSugar?: number | null;
  steps?: number | null;
  waterIntake?: number | null;
  metadata?: Record<string, unknown> | null;
}

/** Beneficiary profile linked to a patient (mother): vitals and service requests; no wallet. */
export interface BeneficiaryDetailDto {
  id: number;
  /** Patient ID of the beneficiary (for service requests / vitals API). */
  patientId: number;
  name: string;
  relation?: string | null;
  vitals: VitalsEntryDto[];
  serviceRequestsByStatus: ServiceRequestsByStatusDto;
}

/** Full patient details: GET /v1/admin/patients/:patientId/details. Wallet is for account holder (mother) only. Wallet fields per api_business_flow §11. */
export interface PatientFullDetailsDto {
  user: AdminUserDetailUserDto;
  patient: PatientFullProfileDto;
  serviceRequestsByStatus: ServiceRequestsByStatusDto;
  wallet?: AdminWalletDetailDto | null;
  totalBalance?: string | null;
  claimableBalance: string;
  nonClaimableBalance?: string | null;
  cashCommissionDue?: string | null;
  pendingWithdrawal?: string | null;
  walletHistory: WalletHistoryEntryDto[];
  /** Beneficiaries linked to this patient (e.g. dependents). Each has vitals and service requests; no wallet. */
  beneficiaries?: BeneficiaryDetailDto[] | null;
}

export const providersApi = {
  /**
   * GET /v1/admin/providers — List all provider profiles (providers table).
   * Role: ADMIN. Query: page, limit, consultationTypeId, status (PENDING | ACTIVE | REJECTED | DEACTIVATED | ARCHIVED).
   */
  getList: async (
    params?: {
      page?: number;
      limit?: number;
      consultationTypeId?: number;
      status?: ProviderListStatusFilter;
      documentType?: string;
    },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    if (params?.consultationTypeId != null) {
      query.consultationTypeId = params.consultationTypeId;
    }
    if (params?.status && params.status !== "all") {
      query.status = params.status.toUpperCase();
    }
    if (params?.documentType != null && params.documentType !== "") {
      query.documentType = params.documentType;
    }
    return httpService.get<AdminProviderListResponse>("/admin/providers", {
      params: query,
      signal: config?.signal,
    });
  },

  /** GET /v1/admin/providers/:providerId/details - Full provider details (Admin only). */
  getDetails: async (providerId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<ProviderFullDetailsDto>(`/admin/providers/${providerId}/details`, {
      signal: config?.signal,
    });
  },
  /** PATCH /v1/admin/providers/:providerId/consultation-services - Update which services this provider offers (excludedServiceIds = not offered). */
  updateConsultationServices: async (
    providerId: number,
    body: { excludedServiceIds: number[] }
  ) => {
    return httpService.patch<ProviderConsultationTypeServiceItemDto[]>(
      `/admin/providers/${providerId}/consultation-services`,
      body
    );
  },
  /** GET /v1/admin/providers/:providerId/service-requests - Service requests grouped by consultation type. Optional status filter. */
  getServiceRequests: async (
    providerId: number,
    params?: { status?: AdminServiceRequestStatus },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    return httpService.get<ServiceDetailsByConsultationTypeEntryDto[]>(
      `/admin/providers/${providerId}/service-requests`,
      { params: query, signal: config?.signal }
    );
  },

  /** GET /v1/admin/providers/:providerId/certifications - List certifications (and linked documents) for this provider (Admin, per api_business_flow §4b). */
  getCertifications: async (providerId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<AdminCertificationDto[]>(
      `/admin/providers/${providerId}/certifications`,
      { signal: config?.signal }
    );
  },

  /** PATCH /v1/admin/providers/:providerId/verify - Set provider status. Allowed transitions: PENDING → Rejected/Active/Deactivated/Archived; ACTIVE → Pending/Rejected. */
  verifyProvider: async (
    providerId: number,
    data: { status: "PENDING" | "ACTIVE" | "REJECTED" | "DEACTIVATED" | "ARCHIVED"; comment?: string },
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<ProviderFullProfileDto>(
      `/admin/providers/${providerId}/verify`,
      data,
      config
    );
  },

  /** POST /providers/search - Search with location, type, date, time, pagination */
  search: async (data: ProviderSearchRequest) => {
    return httpService.post<PaginatedResponse<ProviderSearchResult>>("/providers/search", data);
  },

  /** POST /providers/:providerId/search - Single provider with slots/distance (same shape as one search result). */
  getProviderByIdForSearch: async (providerId: number, data?: SingleProviderSearchRequest) => {
    return httpService.post<ProviderSearchResult>(`/providers/${providerId}/search`, data ?? {});
  },

  /** PUT /providers/specialty */
  updateSpecialty: async (consultationTypeId: number) => {
    return httpService.put("/providers/specialty", { consultationTypeId });
  },

  /** PUT /providers/location */
  updateLocation: async (latitude: number, longitude: number) => {
    return httpService.put("/providers/location", { latitude, longitude });
  },

  /** PUT /providers/service-radius */
  updateServiceRadius: async (serviceRadiusKm: number) => {
    return httpService.put("/providers/service-radius", { serviceRadiusKm });
  },

  /** PUT /providers/billing-rate */
  updateBillingRate: async (data: BillingRateRequest) => {
    return httpService.put("/providers/billing-rate", data);
  },

  /** GET /providers/billing-rate/current */
  getBillingRateCurrent: async () => {
    return httpService.get<{ id: number; amount: number; type: string; validFrom: string }>(
      "/providers/billing-rate/current"
    );
  },

  /** GET /providers/billing-rate/history */
  getBillingRateHistory: async () => {
    return httpService.get<BillingRateHistoryResponse>("/providers/billing-rate/history");
  },

  /** PUT /providers/me/schedule - Set available schedule slots */
  setSchedule: async (slots: ScheduleSlotInput[]) => {
    return httpService.put<ScheduleSlot[]>("/providers/me/schedule", slots);
  },

  /** GET /providers/me/schedule - Optional startDate, endDate */
  getSchedule: async (params?: { startDate?: string; endDate?: string }) => {
    return httpService.get<ScheduleSlot[]>("/providers/me/schedule", { params });
  },

  /** DELETE /providers/me/schedule/slots?ids=1,2,3 */
  deleteScheduleSlots: async (ids: number[]) => {
    return httpService.delete("/providers/me/schedule/slots", {
      params: { ids: ids.join(",") },
    });
  },
};

// ============== Service Requests API ==============

export const serviceRequestsApi = {
  /** POST /service-requests */
  create: async (data: CreateServiceRequestRequest) => {
    return httpService.post<ServiceRequest>("/service-requests", data);
  },

  /** GET /service-requests/nearby - For providers */
  getNearby: async (params: { latitude: number; longitude: number; radiusKm?: number }) => {
    return httpService.get<ServiceRequest[]>("/service-requests/nearby", { params });
  },

  /** PATCH /service-requests/:id/accept */
  accept: async (id: number) => {
    return httpService.patch<ServiceRequest>(`/service-requests/${id}/accept`);
  },

  /** PATCH /service-requests/:id/reject */
  reject: async (id: number, data?: RejectRequestInput) => {
    return httpService.patch<ServiceRequest>(`/service-requests/${id}/reject`, data ?? {});
  },

  /** PATCH /service-requests/:id/status - status: COMPLETED | CANCELLED */
  updateStatus: async (id: number, status: "COMPLETED" | "CANCELLED") => {
    return httpService.patch<ServiceRequest>(`/service-requests/${id}/status`, { status });
  },

  /** POST /service-requests/:id/request-start-otp */
  requestStartOtp: async (id: number) => {
    return httpService.post(`/service-requests/${id}/request-start-otp`);
  },

  /** POST /service-requests/:id/verify-start-otp */
  verifyStartOtp: async (id: number, otp: string) => {
    return httpService.post(`/service-requests/${id}/verify-start-otp`, { otp });
  },

  /** GET /service-requests/patient/my-requests */
  getPatientMyRequests: async (params?: { page?: number; limit?: number }) => {
    return httpService.get<PaginatedResponse<ServiceRequest>>(
      "/service-requests/patient/my-requests",
      { params }
    );
  },

  /** GET /service-requests/provider/my-requests */
  getProviderMyRequests: async (params?: { page?: number; limit?: number }) => {
    return httpService.get<PaginatedResponse<ServiceRequest>>(
      "/service-requests/provider/my-requests",
      { params }
    );
  },

  /** POST /service-requests/:id/confirm-payment - CASH payment confirmation */
  confirmPayment: async (id: number) => {
    return httpService.post<ServiceRequest>(`/service-requests/${id}/confirm-payment`);
  },
};

// ============== Verification Documents API ==============

export const verificationDocumentsApi = {
  /**
   * GET /verification-documents
   * Returns verification document requirements (by consultation type) and user's documents.
   * @param consultationTypeId - Optional. When provided, requirements are scoped to this type (e.g. for upgrade).
   */
  getMyDocumentsWithRequirements: async (consultationTypeId?: number) => {
    const params = consultationTypeId != null ? { consultationTypeId } : undefined;
    return httpService.get<DocumentsWithRequirementsResponseDto>("/verification-documents", {
      params,
    });
  },

  /**
   * POST /verification-documents/upload
   * Prefer verificationRequirementId (from GET response requirements[].id); otherwise pass type.
   */
  upload: async (
    file: File,
    options: { verificationRequirementId?: number; type?: string }
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.verificationRequirementId != null) {
      formData.append("verificationRequirementId", String(options.verificationRequirementId));
    }
    if (options.type != null && options.type !== "") {
      formData.append("type", options.type);
    }
    return httpService.uploadFile<DocumentUploadResponse>("/verification-documents/upload", formData);
  },

  /** DELETE /verification-documents/:id */
  deleteDocument: async (id: number) => {
    return httpService.delete<unknown>(`/verification-documents/${id}`);
  },
};

/** @deprecated Use verificationDocumentsApi */
export const documentsApi = verificationDocumentsApi;

// ============== Patient Vitals API ==============

export const patientVitalsApi = {
  /** POST /patient-vitals */
  record: async (data: RecordVitalsRequest) => {
    return httpService.post("/patient-vitals", data);
  },

  /** GET /patient-vitals/:patientId - Use "me" for current patient */
  getHistory: async (patientId: number | "me") => {
    return httpService.get(`/patient-vitals/${patientId}`);
  },

  /** GET /patient-vitals/me/range or /patient-vitals/:patientId/range */
  getRange: async (
    patientId: "me" | number,
    params?: { startDate?: string; endDate?: string }
  ) => {
    const path = patientId === "me" ? "/patient-vitals/me/range" : `/patient-vitals/${patientId}/range`;
    return httpService.get(path, { params });
  },
};

// ============== Notifications API ==============

export const notificationsApi = {
  /** POST /notifications/device - Register FCM token */
  registerDevice: async (data: RegisterDeviceRequest) => {
    return httpService.post<{ message: string }>("/notifications/device", data);
  },
  /** GET /notifications - List my notifications (paginated). status: ACTIVE (default) | ARCHIVED */
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: "ACTIVE" | "ARCHIVED";
  }) => {
    return httpService.get<NotificationHistoryListResponse>("/notifications", {
      params: params as Record<string, string | number>,
    });
  },
  /** PATCH /notifications/:id/read - Mark one as read */
  markAsRead: async (id: number) => {
    return httpService.patch(`/notifications/${id}/read`, {});
  },
  /** POST /notifications/mark-all-read - Mark all active as read. Returns { count }. */
  markAllAsRead: async () => {
    return httpService.post<{ count: number }>("/notifications/mark-all-read", {});
  },
  /** POST /notifications/test-push - Send test push to a user (e.g. admin). */
  testPush: async (data: TestPushRequest) => {
    return httpService.post<{ sent: boolean; message: string }>("/notifications/test-push", data);
  },
};

// ============== Financial API ==============

export const financialApi = {
  /** GET /financial/wallet/me */
  getWallet: async () => {
    return httpService.get<WalletResponse>("/financial/wallet/me");
  },

  /** GET /financial/claimable-balance - Provider only */
  getClaimableBalance: async () => {
    return httpService.get<ClaimableBalanceResponse>("/financial/claimable-balance");
  },

  /** GET /financial/claimable-balance/history */
  getClaimableBalanceHistory: async () => {
    return httpService.get("/financial/claimable-balance/history");
  },

  /** POST /financial/claimable-balance/claim */
  claimBalance: async (data?: ClaimBalanceRequest) => {
    return httpService.post("/financial/claimable-balance/claim", data ?? {});
  },

  /** GET /financial/transactions */
  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return httpService.get("/financial/transactions", { params });
  },

  /** GET /financial/transactions/:id */
  getTransactionDetails: async (id: number) => {
    return httpService.get(`/financial/transactions/${id}`);
  },

  /** GET /financial/ledger */
  getLedger: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    entryType?: "DEBIT" | "CREDIT";
  }) => {
    return httpService.get("/financial/ledger", { params });
  },

  /** POST /financial/recharge/initiate */
  initiateRecharge: async (data: { amount: number; paymentGateway?: string }) => {
    return httpService.post<{ transactionId: number; paymentGateway: string; gatewayUrl: string }>(
      "/financial/recharge/initiate",
      data
    );
  },
};

// ============== Patients API (admin / list) ==============

export interface PatientListItem {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  username: string; // mobile (normalized) for patients
  nidNumber?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** Response shape for GET /v1/admin/patients (admin patients list from patients table) */
export type PatientsListResponse = {
  patients: PatientListItem[];
  total: number;
  page: number;
  limit: number;
};

export const patientsApi = {
  /** POST /patients/me/liked-providers/:providerId - Like a provider (idempotent). PATIENT only. */
  likeProvider: async (providerId: number) => {
    return httpService.post<{ message: string; providerId: number }>(`/patients/me/liked-providers/${providerId}`);
  },
  /** DELETE /patients/me/liked-providers/:providerId - Unlike. PATIENT only. */
  unlikeProvider: async (providerId: number) => {
    return httpService.delete(`/patients/me/liked-providers/${providerId}`);
  },
  /** GET /patients/me/liked-providers - List liked providers (paginated). PATIENT only. */
  getLikedProviders: async (params?: { page?: number; limit?: number }) => {
    return httpService.get<{ data: LikedProviderItemDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }>("/patients/me/liked-providers", params ? { params } : undefined);
  },
  /** GET /v1/admin/patients/:patientId/details - Full patient details (Admin only). */
  getDetails: async (patientId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<PatientFullDetailsDto>(`/admin/patients/${patientId}/details`, {
      signal: config?.signal,
    });
  },
  /** PATCH /v1/admin/patients/:patientId/status - Set patient status. Same rules as provider: PENDING → Rejected/Active/Deactivated/Archived; ACTIVE → Pending/Rejected only. */
  verifyPatient: async (
    patientId: number,
    data: { status: "PENDING" | "ACTIVE" | "REJECTED" | "DEACTIVATED" | "ARCHIVED"; comment?: string },
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<PatientFullProfileDto>(
      `/admin/patients/${patientId}/status`,
      data,
      config
    );
  },
  /** GET /v1/admin/patients/:patientId/beneficiaries - List beneficiaries with vitals and service requests (Admin). Optional; may be included in details. */
  getBeneficiaries: async (patientId: number, config?: { signal?: AbortSignal }) => {
    const res = await httpService.get<BeneficiaryDetailDto[] | { beneficiaries: BeneficiaryDetailDto[] }>(
      `/admin/patients/${patientId}/beneficiaries`,
      { signal: config?.signal }
    );
    const data = res?.data ?? res;
    return Array.isArray(data) ? { data } : { data: (data as { beneficiaries: BeneficiaryDetailDto[] }).beneficiaries ?? [] };
  },
  /** GET /v1/admin/patients/:patientId/service-requests - Service requests grouped by consultation type. Optional status filter. */
  getServiceRequests: async (
    patientId: number,
    params?: { status?: AdminServiceRequestStatus },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    return httpService.get<ServiceDetailsByConsultationTypeEntryDto[]>(
      `/admin/patients/${patientId}/service-requests`,
      { params: query, signal: config?.signal }
    );
  },
  /** GET /v1/admin/patients - List all patient profiles (Admin only, patients table). Query: page, limit, search. Same pattern as GET /admin/providers. */
  getList: async (
    params?: { page?: number; limit?: number; search?: string },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    const search = params?.search?.trim();
    if (search) query.search = search;
    return httpService.get<PatientsListResponse>("/admin/patients", {
      params: query,
      signal: config?.signal,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
  },
};

// ============== Admin service requests (appointments) list – api_business_flow §5c ==============

export const adminServiceRequestsApi = {
  /**
   * GET /v1/admin/service-requests — List all appointments. Query: page, limit, consultationTypeId, searchDoctor, searchPatient.
   */
  getList: async (
    params?: {
      page?: number;
      limit?: number;
      consultationTypeId?: number;
      searchDoctor?: string;
      searchPatient?: string;
    },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    if (params?.consultationTypeId != null) query.consultationTypeId = params.consultationTypeId;
    const doc = params?.searchDoctor?.trim();
    if (doc) query.searchDoctor = doc;
    const pat = params?.searchPatient?.trim();
    if (pat) query.searchPatient = pat;
    return httpService.get<AdminServiceRequestListResponse>("/admin/service-requests", {
      params: query,
      signal: config?.signal,
    });
  },
};

// ============== Dashboard API (admin summary) ==============

/** Service request counts by status for dashboard chart. */
export interface DashboardServiceRequestsSummary {
  PENDING?: number;
  ACCEPTED?: number;
  IN_PROGRESS?: number;
  COMPLETED?: number;
  CANCELLED?: number;
  REJECTED?: number;
}

/** Single recent service request for dashboard "Recent activity". */
export interface DashboardRecentServiceRequest {
  id: number;
  patientName?: string | null;
  providerName?: string | null;
  status: string;
  consultationTypeName?: string | null;
  createdAt: string;
}

/**
 * Dashboard summary — single response for the admin dashboard.
 * Backend implements GET /admin/dashboard/summary and returns all of these in one response.
 */
export interface DashboardSummaryDto {
  patients?: { total?: number; pending?: number };
  providers?: { total?: number; pending?: number; active?: number; rejected?: number };
  serviceRequests?: DashboardServiceRequestsSummary;
  pendingCertifications?: number;
  recentServiceRequests?: DashboardRecentServiceRequest[];
}

/** Normalize backend response (handles wrapped body and snake_case). */
function normalizeDashboardSummary(raw: unknown): DashboardSummaryDto {
  if (raw == null || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  // Unwrap if backend returns { data: { ... } }
  const body = (obj.data != null && typeof obj.data === "object" ? obj.data : obj) as Record<string, unknown>;

  const patients = body.patients as DashboardSummaryDto["patients"];
  const providers = body.providers as DashboardSummaryDto["providers"];
  const serviceRequests = (body.serviceRequests ?? body.service_requests) as DashboardSummaryDto["serviceRequests"];
  const pendingCertifications =
    typeof body.pendingCertifications === "number"
      ? body.pendingCertifications
      : typeof (body as Record<string, unknown>).pending_certifications === "number"
        ? (body as Record<string, unknown>).pending_certifications
        : 0;
  const rawRecent = body.recentServiceRequests ?? (body as Record<string, unknown>).recent_service_requests;
  const recentServiceRequests: DashboardRecentServiceRequest[] = Array.isArray(rawRecent)
    ? rawRecent.map((item: Record<string, unknown>) => ({
        id: Number(item.id),
        patientName: item.patientName ?? item.patient_name ?? null,
        providerName: item.providerName ?? item.provider_name ?? null,
        status: String(item.status ?? ""),
        consultationTypeName: item.consultationTypeName ?? item.consultation_type_name ?? null,
        createdAt: String(item.createdAt ?? item.created_at ?? ""),
      })) as DashboardRecentServiceRequest[]
    : [];

  return {
    patients,
    providers,
    serviceRequests: serviceRequests ?? undefined,
    pendingCertifications: Number(pendingCertifications) || 0,
    recentServiceRequests,
  };
}

export const dashboardApi = {
  /** GET /admin/dashboard/summary — single call for dashboard. Returns all KPIs, chart data, and recent activity. */
  getSummary: async (config?: { signal?: AbortSignal }) => {
    const res = await httpService.get<unknown>("/admin/dashboard/summary", {
      signal: config?.signal,
    });
    return { ...res, data: normalizeDashboardSummary(res.data) };
  },
};

// ============== Users API (admin – list all users) ==============

export interface UserListItem {
  id: number;
  email?: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string; // ADMIN | PROVIDER | PATIENT
  isActive?: boolean;
  /** Backend may send snake_case */
  is_active?: boolean;
  createdAt: string;
  updatedAt?: string;
  /** For PROVIDER only: backend includes providerId, bmdcNumber, consultationTypeId, consultationTypeName */
  providerId?: number;
  bmdcNumber?: string;
  consultationTypeId?: number;
  consultationTypeName?: string;
}

/** Backend returns { users: [], total, page, limit } (no totalPages) */
export type UsersListResponse = {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
};

/** Status filter for user list (per api_business_flow: GET /v1/admin/users ?status=active|inactive|deactivate). Omit = all. */
export type UserListStatusFilter = "all" | "active" | "inactive";

export const usersListApi = {
  /** GET /v1/admin/users - List all users (Admin only). Query: page, limit, search, status, role (e.g. PROVIDER). Omit status/role for all. */
  getList: async (
    params?: { page?: number; limit?: number; search?: string; status?: UserListStatusFilter; role?: string },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    const search = params?.search?.trim();
    if (search) query.search = search;
    if (params?.status === "active") query.status = "active";
    if (params?.status === "inactive") query.status = "inactive";
    if (params?.role) query.role = params.role;
    return httpService.get<UsersListResponse>("/admin/users", {
      params: query,
      signal: config?.signal,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
  },
};

// ============== Admin User API (per api_business_flow §7) ==============

export interface UpdateUserStatusRequest {
  isActive: boolean; // true = active, false = deactivate
  /** Optional reason/comment for the status change (if backend supports it). */
  comment?: string;
}

/** Response from PATCH /admin/users/:userId/status (UserResponseDto) */
export interface UpdateUserStatusResponse {
  id: number;
  email?: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** Admin-only: set/change user password. PATCH /v1/admin/users/:userId/password */
export interface AdminUpdatePasswordRequest {
  newPassword: string;
}

/** Document item for admin list (e.g. GET /admin/users/:userId/documents). */
export interface AdminDocumentDto {
  id: number;
  type: string;
  status: string;
  createdAt: string;
  /** If present, open in new tab to view/download. */
  viewUrl?: string | null;
  filePath?: string | null;
  path?: string | null;
  adminComment?: string | null;
}

/** Admin-only: update user active status. PATCH /v1/admin/users/:userId/status */
export const adminUsersApi = {
  updateStatus: async (userId: string, data: UpdateUserStatusRequest) => {
    return httpService.patch<UpdateUserStatusResponse>(
      `/admin/users/${userId}/status`,
      data
    );
  },
  /** Admin-only: set user password. PATCH /v1/admin/users/:userId/password */
  updatePassword: async (userId: string, data: AdminUpdatePasswordRequest) => {
    return httpService.patch<{ message?: string }>(
      `/admin/users/${userId}/password`,
      data
    );
  },
  /** GET /v1/admin/users/:userId/documents - List documents uploaded by this user (e.g. provider). Admin only. */
  getDocuments: async (userId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<AdminDocumentDto[]>(`/admin/users/${userId}/documents`, {
      signal: config?.signal,
    });
  },
  /** GET /v1/admin/users/:userId/verification-documents?consultationTypeId=X - Requirements + user uploads for that type (e.g. upgrade target). Admin only. */
  getUserVerificationDocuments: async (
    userId: number,
    consultationTypeId: number,
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.get<AdminVerificationDocumentsResponse>(
      `/admin/users/${userId}/verification-documents`,
      { params: { consultationTypeId }, signal: config?.signal }
    );
  },
};

/** Admin: GET users/:userId/verification-documents response (requirements + uploads for a consultation type). */
export interface AdminVerificationDocumentsResponse {
  consultationTypeId: number | null;
  consultationTypeName: string | null;
  requirements: Array<{
    id: number;
    documentType: string;
    isRequired: boolean;
    displayOrder: number;
    uploadedDocument: AdminDocumentDto | null;
  }>;
  documents: AdminDocumentDto[];
}

/** Admin: verify a document (approve/reject). POST /v1/admin/documents/:id/verify */
export interface AdminVerifyDocumentRequest {
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminComment?: string;
}

export const adminDocumentsApi = {
  verify: async (documentId: number, data: AdminVerifyDocumentRequest) => {
    return httpService.post<AdminDocumentDto>(`/admin/documents/${documentId}/verify`, data);
  },
};

// ============== Admin Financial API ==============

export interface GlWalletReconciliationDto {
  walletType: string;
  walletId: number | null;
  balance: string;
  currency: string;
  totalCredit: string;
  totalDebit: string;
  netChange: string;
}

export interface GlProfitSummaryDto {
  commissionBalance: string;
  commissionNetChange: string;
}

export interface GlReconciliationSummaryResponseDto {
  wallets: GlWalletReconciliationDto[];
  profitSummary: GlProfitSummaryDto;
}

export interface GlDailyFlowEntryDto {
  date: string;
  totalCredit: string;
  totalDebit: string;
  netChange: string;
  wallets: GlWalletReconciliationDto[];
}

export interface GlDailyFlowResponseDto {
  startDate: string;
  endDate: string;
  days: GlDailyFlowEntryDto[];
  total: { totalCredit: string; totalDebit: string; netChange: string };
}

export interface ProviderTransactionLedgerEntryDto {
  id: number;
  amount: string;
  balanceBefore: string | null;
  balanceAfter: string;
  type: string;
  description?: string | null;
  createdAt: string;
}

export interface ProviderTransactionHistoryResponseDto {
  data: ProviderTransactionLedgerEntryDto[];
  total: number;
  page: number;
  limit: number;
}

export const adminFinancialApi = {
  getGlReconciliationSummary: async (config?: { signal?: AbortSignal }) => {
    return httpService.get<GlReconciliationSummaryResponseDto>("/admin/financial/gl-reconciliation", {
      signal: config?.signal,
    });
  },
  getGlReconciliationHistory: async (
    params: { startDate: string; endDate: string },
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.get<GlDailyFlowResponseDto>("/admin/financial/gl-reconciliation/history", {
      params: { startDate: params.startDate, endDate: params.endDate },
      signal: config?.signal,
    });
  },
  getProviderTransactionHistory: async (
    providerId: number,
    params?: { startDate?: string; endDate?: string; page?: number; limit?: number },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {};
    if (params?.startDate) query.startDate = params.startDate;
    if (params?.endDate) query.endDate = params.endDate;
    if (params?.page != null) query.page = params.page;
    if (params?.limit != null) query.limit = params.limit;
    return httpService.get<ProviderTransactionHistoryResponseDto>(
      `/admin/financial/providers/${providerId}/transactions`,
      { params: query, signal: config?.signal }
    );
  },
};

// ============== Admin Provider Salary & Billing Rate ==============

export type SalaryFrequency = "MONTHLY" | "WEEKLY";
export type BillingRateType = "CONSULTATION" | "HOURLY";

export interface ProviderSalaryRecordDto {
  id: number;
  providerId: number;
  amount: string;
  frequency: SalaryFrequency;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface SalaryHistoryResponseDto {
  currentSalary: ProviderSalaryRecordDto | null;
  history: ProviderSalaryRecordDto[];
}

export interface BillingRateRecordDto {
  id: number;
  providerId: number;
  amount: string;
  type: BillingRateType;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface BillingRateHistoryResponseDto {
  currentRate: BillingRateRecordDto | null;
  history: BillingRateRecordDto[];
}

export interface ProviderWalletFundingHistoryEntryDto {
  transactionId: number;
  purpose: "WALLET_RECHARGE" | "ADMIN_MANUAL_CREDIT";
  status: string;
  paymentMethod: string | null;
  amount: string;
  reason: string | null;
  reference: string | null;
  gatewayName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProviderWalletFundingHistoryResponseDto {
  data: ProviderWalletFundingHistoryEntryDto[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const adminProvidersApi = {
  setProviderSalary: async (providerId: number, data: { amount: number; frequency?: SalaryFrequency }) => {
    return httpService.post<ProviderSalaryRecordDto>(`/admin/providers/${providerId}/salary`, data);
  },
  getProviderSalaryHistory: async (providerId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<SalaryHistoryResponseDto>(`/admin/providers/${providerId}/salary/history`, {
      signal: config?.signal,
    });
  },
  setProviderBillingRate: async (providerId: number, data: { amount: number; type: BillingRateType }) => {
    return httpService.post<BillingRateRecordDto>(`/admin/providers/${providerId}/billing-rate`, data);
  },
  getProviderBillingRateHistory: async (providerId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<BillingRateHistoryResponseDto>(`/admin/providers/${providerId}/billing-rate/history`, {
      signal: config?.signal,
    });
  },
  manualWalletCredit: async (
    providerId: number,
    data: { amount: number; reason: string; reference?: string }
  ) => {
    return httpService.post<{ transactionId: number }>(
      `/admin/providers/${providerId}/wallet/manual-credit`,
      data
    );
  },
  getWalletFundingHistory: async (
    providerId: number,
    params?: { page?: number; limit?: number }
  ) => {
    return httpService.get<ProviderWalletFundingHistoryResponseDto>(
      `/admin/providers/${providerId}/wallet/history`,
      params ? { params } : undefined
    );
  },
};

/** Admin: verify certification (approve/reject). PATCH /v1/admin/certifications/:id/verify (api_business_flow §4b) */
export interface AdminVerifyCertificationRequest {
  status: "APPROVED" | "REJECTED";
  adminComment?: string;
}

export const adminCertificationsApi = {
  verify: async (certificationId: number, data: AdminVerifyCertificationRequest) => {
    return httpService.patch<AdminCertificationDto>(
      `/admin/certifications/${certificationId}/verify`,
      data
    );
  },
};

// ============== User API (legacy / profile) ==============

export const userApi = {
  getProfile: async (userId: string) => {
    return httpService.get(`/users/${userId}`);
  },
  updateProfile: async (userId: string, data: Record<string, unknown>) => {
    return httpService.put(`/users/${userId}`, data);
  },
  deleteUser: async (userId: string) => {
    return httpService.delete(`/users/${userId}`);
  },
};

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

/** POST /v1/users/register — public; creates user with fixed role (e.g. supervisor). */
export interface RegisterSupervisorRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "SUPERVISOR";
}

/** Typical user payload returned after registration (shape may vary by backend). */
export type RegisterSupervisorUserFields = {
  id?: number;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

export type RegisterSupervisorResponse = RegisterSupervisorUserFields & {
  user?: RegisterSupervisorUserFields;
};

// ============== Forgot Password ==============

export interface PasswordResetRequestRequest {
  identifier: string; // Email or phone
}

export interface PasswordResetVerifyOtpRequest {
  /** Email or phone — same value supplied to /password-reset/request. */
  identifier: string;
  /** 6-digit one-time code delivered to the identifier. */
  otpCode: string;
}

export interface PasswordResetVerifyOtpResponse {
  /** UUID token to pass to /password-reset/reset. */
  verificationToken: string;
}

export interface PasswordResetRequest {
  /** Email or phone (Bangladeshi format) — same value the user supplied to request the reset. */
  identifier: string;
  /** UUID token delivered in the reset link / from verify-otp. */
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
  /** JSON string of the file upload API response (image), if stored by backend. */
  imageUrl?: string | null;
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

/** Lifetime / monthly stats on GET /financial/wallet/me (providers only). */
export interface WalletOverviewDto {
  totalEarnedLifetime: string;
  totalServiceHoursLifetime: number;
  completedJobsCount: number;
  avgEarningsPerCompletedJob: string | null;
  currentMonthEarnings: string;
  previousMonthEarnings: string;
  monthOverMonthPercent: number | null;
}

/** GET /financial/wallet/me — per hope-backend api_business_flow §11. */
export interface WalletResponse {
  /** USER wallet — cash earnings + withdrawn online earnings. */
  walletBalance: string;
  /** CLAIMABLE wallet — online earnings available to withdraw (hero amount on mobile). */
  claimableBalance: string;
  totalBalance: string;
  pendingWithdrawal: string;
  /** claimableBalance − pendingWithdrawal. */
  availableToWithdraw: string;
  currency: string;
  overview?: WalletOverviewDto;
}

export interface ClaimableBalanceResponse {
  total: number;
  breakdown?: Array<{ serviceRequestId: number; amount: number }>;
}

export interface ClaimBalanceRequest {
  amount?: number; // optional; if omitted, claim all
}

export type WithdrawalRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface WithdrawalRequestListItem {
  id: number;
  providerId?: number | null;
  providerName?: string | null;
  amount?: string | number | null;
  status: WithdrawalRequestStatus | string;
  createdAt?: string | null;
  requestedAt?: string | null;
  updatedAt?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  method?: string | null;
  reference?: string | null;
}

export interface WithdrawalRequestListResponse {
  data: WithdrawalRequestListItem[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface WithdrawalRequestDetail extends WithdrawalRequestListItem {
  walletId?: number | null;
  userId?: number | null;
  method?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  mobileNumber?: string | null;
  proofUrl?: string | null;
  adminNote?: string | null;
  [key: string]: unknown;
}

export interface WithdrawalReviewPayload {
  adminNote?: string;
}

export interface WithdrawalCompletePayload extends WithdrawalReviewPayload {
  proofUrl?: string;
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

  /** POST /users/register — email/username/password + names + role (e.g. SUPERVISOR). No auth. */
  registerSupervisor: async (data: RegisterSupervisorRequest) => {
    return httpService.requestWithoutAuth<RegisterSupervisorResponse>("POST", "/users/register", data);
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
  /** JSON.stringify of POST /files/upload response body (backend field name). */
  imageUrl?: string;
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
  /** JSON.stringify of POST /files/upload response body. Omit to leave existing value. */
  imageUrl?: string;
}

/** Multipart upload to external file service. Override with `VITE_FILE_UPLOAD_URL` (no trailing slash). */
const FILE_UPLOAD_BASE_URL =
  (import.meta.env.VITE_FILE_UPLOAD_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://116.68.207.105:3085";

/** Required by the file service (401 if missing/wrong). Override via `VITE_FILE_UPLOAD_API_KEY`. */
const FILE_UPLOAD_API_KEY =
  (import.meta.env.VITE_FILE_UPLOAD_API_KEY as string | undefined)?.trim() ||
  "hope-project-key-123";

/**
 * POST /files/upload — returns parsed JSON (or raw text if not JSON).
 * Sends only `x-api-key` (required). Do not send `Authorization: Bearer` here: this service
 * treats Authorization as the project API key and rejects JWTs with "Invalid API key".
 */
export async function uploadFileToStorage(file: File): Promise<unknown> {
  const url = `${FILE_UPLOAD_BASE_URL}/files/upload`;
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {
    accept: "*/*",
    "x-api-key": FILE_UPLOAD_API_KEY,
  };
  const res = await fetch(url, { method: "POST", headers, body: formData });
  const text = await res.text();
  if (!res.ok) {
    let message = text?.trim() || `Upload failed (${res.status})`;
    try {
      const errJson = JSON.parse(text) as { message?: string };
      if (errJson?.message && typeof errJson.message === "string") {
        message = errJson.message;
      }
    } catch {
      /* keep message */
    }
    throw new Error(message);
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
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

  // --- Admin: Service category checklists per consultation type ---
  /** GET /admin/consultation-types/:id/service-category-checklists */
  getServices: async (consultationTypeId: number) => {
    return httpService.get<ServiceCategoryChecklistItem[]>(
      `/admin/consultation-types/${consultationTypeId}/service-category-checklists`
    );
  },
  /** POST /admin/consultation-types/:id/service-category-checklists */
  createService: async (
    consultationTypeId: number,
    data: {
      name: string;
      description?: string | null;
      type?: ServiceCategoryChecklistType;
      isActive?: boolean;
      displayOrder?: number;
      groupId?: number;
    }
  ) => {
    return httpService.post<ServiceCategoryChecklistItem>(
      `/admin/consultation-types/${consultationTypeId}/service-category-checklists`,
      data
    );
  },
  /** PATCH /admin/service-category-checklists/:serviceId */
  updateService: async (
    _consultationTypeId: number,
    serviceId: number,
    data: {
      name?: string;
      description?: string | null;
      type?: ServiceCategoryChecklistType;
      isActive?: boolean;
      displayOrder?: number;
      groupId?: number;
    }
  ) => {
    return httpService.patch<ServiceCategoryChecklistItem>(
      `/admin/service-category-checklists/${serviceId}`,
      data
    );
  },
  /** DELETE /admin/service-category-checklists/:serviceId */
  deleteService: async (_consultationTypeId: number, serviceId: number) => {
    return httpService.delete(`/admin/service-category-checklists/${serviceId}`);
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

/** Service category checklist row (admin; per consultation type). */
export type ServiceCategoryChecklistType = "CHECKLIST" | "VITALS";

export interface ServiceCategoryChecklistItem {
  id: number;
  consultationTypeId?: number;
  name: string;
  description?: string | null;
  type?: ServiceCategoryChecklistType;
  isActive: boolean;
  displayOrder: number;
  groupId?: number | null;
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

// ============== Admin: Scheduler jobs ==============

export interface SchedulerJobItem {
  id: number;
  jobKey: string;
  description: string | null;
  runEveryMinutes: number;
  isEnabled: boolean;
  metadata: Record<string, unknown> | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateSchedulerJobPayload {
  runEveryMinutes?: number;
  isEnabled?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundReconcileResult {
  scanned: number;
  settled: number;
  failed: number;
  pending: number;
  escalated: number;
}

/** Linked refund transaction statuses (admin refunds queue filter). */
export type AdminRefundTxStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface CancellationRefundQueueCancellation {
  id: number;
  cancelledAt: string;
  scope: string;
  serviceRequestId: number | null;
  longTermOpportunityId: number | null;
  actor: string;
  actorUserId: number | null;
  actorName: string | null;
  stage: string;
  statusAtCancel: string;
  reasonCategory: string | null;
  reasonNote: string | null;
  feeAmount: string;
  refundAmount: string;
  refundMethod: string;
  adminNotes: string | null;
}

export interface CancellationRefundQueueRefundTx {
  id: number;
  status: string;
  amount: string;
  paymentMethod: string;
  referenceId: string | null;
  referenceType: string | null;
  longTermOpportunityId: number | null;
  patientId: number | null;
  providerId: number | null;
  patientName: string | null;
  providerName: string | null;
  gatewayRefundRefId: string | null;
  gatewayRefundStatus: string | null;
  purpose: string | null;
  adminEscalated: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface CancellationRefundQueueRow {
  cancellation: CancellationRefundQueueCancellation;
  refundTransaction: CancellationRefundQueueRefundTx;
}

export interface CancellationRefundQueueResponse {
  summary: {
    window: { start: string; end: string; filteredBy?: string };
    counts?: {
      total: number;
      pending: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
  };
  data: CancellationRefundQueueRow[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    page?: number;
    total?: number;
  };
}

export interface CancellationRefundQueueQueryParams {
  startDate?: string;
  endDate?: string;
  status?: AdminRefundTxStatus;
  patientId?: number;
  paymentMethod?: "ONLINE" | "CASH";
  cursor?: string;
  page?: number;
  limit?: number;
  includeSummary?: boolean;
  includeTotal?: boolean;
}

export const adminSchedulerApi = {
  /** GET /admin/scheduler/jobs */
  listJobs: async () => {
    return httpService.get<SchedulerJobItem[]>("/admin/scheduler/jobs");
  },
  /** PATCH /admin/scheduler/jobs/:id */
  updateJob: async (id: number, data: UpdateSchedulerJobPayload) => {
    return httpService.patch<SchedulerJobItem>(`/admin/scheduler/jobs/${id}`, data);
  },
};

// ============== Admin: Provider cancel review ==============

export type ProviderCancelReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REASSIGNED"
  | "ALL";

export interface ProviderCancelReviewListItemBase {
  id: number;
  scope?: "SINGLE" | "LONG_TERM";
  reviewStatus: string | null;
  createdAt: string | null;
  reasonCategory: string | null;
  reasonNote: string | null;
  stage: string | null;
  provider: { id: number; userId?: number | null; name: string } | null;
  patient: { id: number; userId?: number; name: string };
}

/** Single service-request cancellation (non-batch). */
export interface ProviderCancelReviewSingleItem extends ProviderCancelReviewListItemBase {
  scope: "SINGLE";
  batchId: null;
  serviceRequest: {
    id: number;
    status: string | null;
    statusAtRequest: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    consultationTypeId: number;
    consultationTypeName: string;
    serviceCategory: string;
    fee: string | null;
  };
}

/** Long-term multi-shift batch cancellation. */
export interface ProviderCancelReviewBatchItem extends ProviderCancelReviewListItemBase {
  scope: "LONG_TERM";
  batchId: string;
  opportunityId: number | null;
  shiftCount: number;
  earliestDate: string | null;
  latestDate: string | null;
}

export type ProviderCancelReviewListItem =
  | ProviderCancelReviewSingleItem
  | ProviderCancelReviewBatchItem;

export function isProviderCancelBatchItem(
  row: ProviderCancelReviewListItem
): row is ProviderCancelReviewBatchItem {
  if (row.scope === "LONG_TERM") return true;
  if (row.scope === "SINGLE") return false;
  const maybeBatch = row as ProviderCancelReviewBatchItem;
  return typeof maybeBatch.batchId === "string" && maybeBatch.batchId.length > 0;
}

export interface ProviderCancelReviewListResponse {
  summary?: {
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    reassignedToday: number;
  };
  data: ProviderCancelReviewListItem[];
  page: number;
  limit: number;
  total?: number;
  hasNext: boolean;
  nextCursor?: string;
}

export interface ProviderCancelReviewListQueryParams {
  status?: ProviderCancelReviewStatus;
  providerId?: number;
  patientId?: number;
  page?: number;
  limit?: number;
  cursor?: string;
  includeSummary?: boolean;
  includeTotal?: boolean;
}

export interface ProviderCancelReviewSuggestedReplacement {
  providerId: number;
  name: string;
  isAvailable: boolean;
}

export interface ProviderCancelReviewHistoryItem {
  id: number;
  reviewStatus: string | null;
  createdAt: string | null;
  reasonCategory: string | null;
}

export interface ServiceTimelineEvent {
  id: number;
  eventType: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
}

export interface ProviderCancelReviewReassignResult {
  id: number;
  reviewStatus: "REASSIGNED";
  serviceRequestId: number;
  newProviderId: number;
  /** PROVIDER_REASSIGN transaction id when net earnings were transferred */
  reassignTransactionId: number | null;
}

export interface ProviderCancelReviewDetail extends ProviderCancelReviewSingleItem {
  refundPreview: {
    feeAmount: string;
    refundAmount: string;
    refundMethod: string;
    note: string;
  };
  cancelHistory: ProviderCancelReviewHistoryItem[];
  suggestedReplacements: ProviderCancelReviewSuggestedReplacement[];
  serviceTimeline: ServiceTimelineEvent[];
}

export const adminProviderCancelApi = {
  list: async (
    params?: ProviderCancelReviewListQueryParams,
    config?: { signal?: AbortSignal }
  ) => {
    const qp: Record<string, string | number | boolean> = {};
    if (params?.status) qp.status = params.status;
    if (params?.providerId != null) qp.providerId = params.providerId;
    if (params?.patientId != null) qp.patientId = params.patientId;
    if (params?.cursor) qp.cursor = params.cursor;
    if (params?.page != null) qp.page = params.page;
    if (params?.limit != null) qp.limit = params.limit;
    if (params?.includeSummary === true) qp.includeSummary = true;
    if (params?.includeTotal === true) qp.includeTotal = true;
    return httpService.get<ProviderCancelReviewListResponse>(
      "/admin/provider-cancel-requests",
      { params: qp, signal: config?.signal }
    );
  },
  detail: async (id: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<ProviderCancelReviewDetail>(
      `/admin/provider-cancel-requests/${id}`,
      { signal: config?.signal }
    );
  },
  approve: async (id: number, body?: { adminNotes?: string; refundAmount?: number }) => {
    return httpService.post(`/admin/provider-cancel-requests/${id}/approve`, body ?? {});
  },
  reject: async (id: number, body: { adminNotes: string }) => {
    return httpService.post(`/admin/provider-cancel-requests/${id}/reject`, body);
  },
  reassign: async (id: number, body: { newProviderId: number; adminNotes?: string }) => {
    return httpService.post<ProviderCancelReviewReassignResult>(
      `/admin/provider-cancel-requests/${id}/reassign`,
      body
    );
  },
  // Batch endpoints (multi-shift LTO provider cancel)
  getBatch: async (batchId: string, config?: { signal?: AbortSignal }) => {
    return httpService.get<{
      batchId: string;
      opportunityId: number | null;
      reviewStatus: string;
      shiftCount: number;
      resolvedCount: number;
      earliestDate: string | null;
      latestDate: string | null;
      reasonCategory: string | null;
      reasonNote: string | null;
      createdAt: string | null;
      provider: { id: number; name: string | null } | null;
      patient: { id: number; name: string | null } | null;
      shifts: Array<{
        cancellationId: number;
        shiftId: number;
        scheduledDate: string | null;
        scheduledTime: string | null;
        fee: string;
        reasonCategory: string | null;
        reasonNote: string | null;
        reviewStatus: string;
        srStatus: string | null;
        previousSrStatus: string | null;
        refundPreview: { feeAmount: string; refundAmount: string };
      }>;
    }>(`/admin/provider-cancel-requests/batch/${batchId}`, { signal: config?.signal });
  },
  processBatch: async (
    batchId: string,
    body: {
      adminNotes?: string;
      actions: Array<{
        cancellationId: number;
        decision: 'approve' | 'reject' | 'reassign';
        refundAmount?: number;
        newProviderId?: number;
        shiftNotes?: string;
      }>;
    }
  ) => {
    return httpService.post<{ batchId: string; processed: number; results: unknown[] }>(
      `/admin/provider-cancel-requests/batch/${batchId}/process`,
      body
    );
  },
};

export const adminCancellationApi = {
  /** GET /admin/refunds — cancellations with linked REFUND transactions (cursor or page). */
  listRefundsQueue: async (
    params?: CancellationRefundQueueQueryParams,
    config?: { signal?: AbortSignal }
  ) => {
    const qp: Record<string, string | number | boolean> = {};
    if (params?.startDate) qp.startDate = params.startDate;
    if (params?.endDate) qp.endDate = params.endDate;
    if (params?.status) qp.status = params.status;
    if (params?.patientId != null) qp.patientId = params.patientId;
    if (params?.paymentMethod) qp.paymentMethod = params.paymentMethod;
    if (params?.cursor) qp.cursor = params.cursor;
    if (params?.page != null) qp.page = params.page;
    if (params?.limit != null) qp.limit = params.limit;
    if (params?.includeSummary === true) qp.includeSummary = true;
    if (params?.includeTotal === true) qp.includeTotal = true;

    return httpService.get<CancellationRefundQueueResponse>("/admin/refunds", {
      params: qp,
      signal: config?.signal,
    });
  },
  /** POST /admin/refunds/reconcile — poll SSL Commerz for pending gateway refunds */
  reconcileRefunds: async () => {
    return httpService.post<RefundReconcileResult>("/admin/refunds/reconcile", {});
  },
};

// ============== Admin: Service Checklist Groups ==============

export interface ServiceChecklistGroupItem {
  id: number;
  name: string;
  nameBn: string;
  description: string;
  descriptionBn: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ServiceChecklistGroupPayload {
  name: string;
  nameBn: string;
  description: string;
  descriptionBn: string;
}

export type ServiceChecklistGroupLang = "en" | "bn";

export const serviceChecklistGroupsApi = {
  /** GET /admin/service-checklist-groups — List all service checklist groups. */
  list: async (params?: { lang?: ServiceChecklistGroupLang }) => {
    return httpService.get<ServiceChecklistGroupItem[]>("/admin/service-checklist-groups", {
      params: { lang: params?.lang ?? "en" },
    });
  },
  /** GET /admin/service-checklist-groups/:id — Get a service checklist group by id. */
  getById: async (id: number, params?: { lang?: ServiceChecklistGroupLang }) => {
    return httpService.get<ServiceChecklistGroupItem>(`/admin/service-checklist-groups/${id}`, {
      params: params?.lang ? { lang: params.lang } : undefined,
    });
  },
  /** POST /admin/service-checklist-groups — Create a service checklist group. */
  create: async (data: ServiceChecklistGroupPayload) => {
    return httpService.post<ServiceChecklistGroupItem>("/admin/service-checklist-groups", data);
  },
  /** PATCH /admin/service-checklist-groups/:id — Update a service checklist group. */
  update: async (id: number, data: ServiceChecklistGroupPayload) => {
    return httpService.patch<ServiceChecklistGroupItem>(`/admin/service-checklist-groups/${id}`, data);
  },
  /** DELETE /admin/service-checklist-groups/:id — Delete a service checklist group. */
  delete: async (id: number) => {
    return httpService.delete<void>(`/admin/service-checklist-groups/${id}`);
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

// ============== Admin: Consultation type levels ==============

export type ConsultationTypeLevelCategory = "DOCTOR" | "CAREGIVER";

export interface ConsultationTypeLevel {
  id: number;
  name: string;
  levelNumber: number;
  category: ConsultationTypeLevelCategory;
  minSalary: number;
  maxSalary: number;
}

export type ConsultationTypeLevelPayload = {
  name: string;
  levelNumber: number;
  category: ConsultationTypeLevelCategory;
  minSalary: number;
  maxSalary: number;
};

/**
 * PATCH body for consultation-type-levels. The admin API update DTO typically expects
 * snake_case JSON keys; POST create still accepts camelCase (common Nest/class-validator setup).
 */
function toConsultationTypeLevelPatchBody(
  data: Partial<ConsultationTypeLevelPayload>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.name !== undefined) out.name = data.name;
  if (data.levelNumber !== undefined) out.level_number = data.levelNumber;
  if (data.category !== undefined) out.category = data.category;
  if (data.minSalary !== undefined) out.min_salary = data.minSalary;
  if (data.maxSalary !== undefined) out.max_salary = data.maxSalary;
  return out;
}

export const consultationTypeLevelsApi = {
  /** GET /admin/consultation-type-levels?category=DOCTOR|CAREGIVER */
  list: async (params: { category: ConsultationTypeLevelCategory }) => {
    return httpService.get<ConsultationTypeLevel[]>("/admin/consultation-type-levels", {
      params: { category: params.category },
    });
  },
  /** GET /admin/consultation-type-levels/:id */
  getById: async (id: number) => {
    return httpService.get<ConsultationTypeLevel>(`/admin/consultation-type-levels/${id}`);
  },
  /** POST /admin/consultation-type-levels */
  create: async (data: ConsultationTypeLevelPayload) => {
    return httpService.post<ConsultationTypeLevel>("/admin/consultation-type-levels", data);
  },
  /** PATCH /admin/consultation-type-levels/:id (snake_case body per update DTO) */
  update: async (id: number, data: Partial<ConsultationTypeLevelPayload>) => {
    return httpService.patch<ConsultationTypeLevel>(
      `/admin/consultation-type-levels/${id}`,
      toConsultationTypeLevelPatchBody(data)
    );
  },
  /** DELETE /admin/consultation-type-levels/:id */
  delete: async (id: number) => {
    return httpService.delete(`/admin/consultation-type-levels/${id}`);
  },
};

// ============== Admin: Level-checklist mappings ==============

export interface CreateLevelChecklistMappingRequest {
  consultationTypeId: number;
  levelId: number;
  checklistIds: number[];
}

export const levelChecklistMappingsApi = {
  /** GET /admin/consultation-types/:consultationTypeId/levels/:levelId/mapped-checklists */
  getMappedChecklists: async (consultationTypeId: number, levelId: number) => {
    return httpService.get<
      | { checklistIds?: number[]; mappedChecklistIds?: number[]; checklists?: Array<{ id?: number }> }
      | number[]
      | Array<{ id?: number }>
    >(`/admin/consultation-types/${consultationTypeId}/levels/${levelId}/mapped-checklists`);
  },
  /** POST /admin/level-checklist-mappings */
  create: async (data: CreateLevelChecklistMappingRequest) => {
    return httpService.post<{ id?: number; message?: string }>(
      "/admin/level-checklist-mappings",
      data
    );
  },
  /** PATCH /admin/level-checklist-mappings */
  update: async (data: CreateLevelChecklistMappingRequest) => {
    return httpService.patch<{ id?: number; message?: string }>(
      "/admin/level-checklist-mappings",
      data
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

// ============== Admin service request schedule (nurse assignment) ==============

/** Nurse row returned by GET .../available-nurses (camelCase). */
export interface ServiceRequestAvailableNurseDto {
  id: string;
  name: string;
  unit?: string;
}

export const serviceRequestScheduleApi = {
  /**
   * GET /admin/service-requests/:requestId/available-nurses
   * Query: startDate, endDate (ISO 8601). Backend may not exist yet — UI uses local mock on failure.
   */
  getAvailableNurses: async (
    requestId: string,
    params: { startDate: string; endDate: string },
    signal?: AbortSignal
  ) => {
    return httpService.get<ServiceRequestAvailableNurseDto[] | { nurses: ServiceRequestAvailableNurseDto[] }>(
      `/admin/service-requests/${encodeURIComponent(requestId)}/available-nurses`,
      { params: { startDate: params.startDate, endDate: params.endDate }, signal }
    );
  },
};

// ============== Providers API ==============

/**
 * Admin provider list item (AdminProviderListDto).
 * GET /v1/admin/providers — providers table + users + consultation_types.
 * Status replaces previous isVerified: PENDING | ACTIVE | REJECTED | ARCHIVED.
 */
export type ProviderStatus = "PENDING" | "ACTIVE" | "AVAILABLE" | "REJECTED" | "ARCHIVED";

export interface ProviderListItem {
  id: number;
  userId: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Some list endpoints send a single display name instead of first/last. */
  name?: string | null;
  fullName?: string | null;
  providerName?: string | null;
  username?: string;
  bmdcNumber?: string;
  /** Profile photo URL or path (relative paths via `getAssetUrl`). */
  profilePicture?: string | null;
  profile_picture?: string | null;
  /** Backend may return string (e.g. "5 years") or number */
  experience?: number | string | null;
  /** Provider status (replaces isVerified). */
  status: ProviderStatus;
  consultationTypeId?: number | null;
  consultationTypeName?: string | null;
  rate?: string | null;
  billingRateType?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** Availability window when listing AVAILABLE providers (admin list). */
  startDate?: string | null;
  endDate?: string | null;
  /** Same as startDate/endDate if API returns snake_case. */
  start_date?: string | null;
  end_date?: string | null;
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

/** Flatten nested `user`, snake_case, and single `name` fields into a list row. */
export function normalizeProviderListItem(raw: unknown): ProviderListItem {
  if (raw == null || typeof raw !== "object") {
    return {
      id: 0,
      userId: 0,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
  }
  const o = raw as Record<string, unknown>;
  const user = o.user && typeof o.user === "object" ? (o.user as Record<string, unknown>) : null;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  let firstName = str(o.firstName) || str(o.first_name) || str(user?.firstName) || str(user?.first_name);
  let lastName = str(o.lastName) || str(o.last_name) || str(user?.lastName) || str(user?.last_name);

  const singleName =
    str(o.name) ||
    str(o.fullName) ||
    str(o.full_name) ||
    str(o.providerName) ||
    str(o.provider_name);
  if ((!firstName || !lastName) && singleName) {
    const parts = singleName.split(/\s+/).filter(Boolean);
    if (!firstName && parts[0]) firstName = parts[0];
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(" ");
    if (!firstName && parts.length === 1) firstName = parts[0];
  }

  const email = str(o.email) || str(user?.email) || undefined;
  const username = str(o.username) || str(user?.username) || undefined;
  const profilePicture =
    str(o.profilePicture) ||
    str(o.profile_picture) ||
    str(user?.profilePicture) ||
    str(user?.profile_picture) ||
    undefined;

  const id = Number(o.id);
  const userId = Number(o.userId ?? user?.id ?? o.id);

  const statusRaw = String(o.status || "ACTIVE").toUpperCase();
  const status = (
    ["PENDING", "ACTIVE", "AVAILABLE", "REJECTED", "ARCHIVED"].includes(statusRaw)
      ? statusRaw
      : "ACTIVE"
  ) as ProviderListItem["status"];

  const bmdcNumber = str(o.bmdcNumber) || str(o.bmdc_number) || undefined;
  const consultationTypeId = Number(o.consultationTypeId ?? o.consultation_type_id);
  const consultationTypeName =
    str(o.consultationTypeName) || str(o.consultation_type_name) || undefined;
  const rate = str(o.rate) || undefined;
  const billingRateType = str(o.billingRateType) || str(o.billing_rate_type) || undefined;
  const updatedAt = str(o.updatedAt) || undefined;
  const startDate = str(o.startDate) || str(o.start_date) || undefined;
  const endDate = str(o.endDate) || str(o.end_date) || undefined;
  const experienceRaw = o.experience;
  const experience =
    typeof experienceRaw === "number" || typeof experienceRaw === "string" ? experienceRaw : null;

  return {
    id: Number.isFinite(id) ? id : 0,
    userId: Number.isFinite(userId) ? userId : 0,
    email,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: singleName || undefined,
    fullName: str(o.fullName) || str(o.full_name) || undefined,
    providerName: str(o.providerName) || str(o.provider_name) || undefined,
    username,
    bmdcNumber,
    profilePicture,
    profile_picture: str(o.profile_picture) || undefined,
    experience,
    status,
    consultationTypeId: Number.isFinite(consultationTypeId) ? consultationTypeId : undefined,
    consultationTypeName,
    rate,
    billingRateType,
    createdAt: str(o.createdAt) || new Date().toISOString(),
    updatedAt,
    startDate,
    endDate,
    start_date: str(o.start_date) || undefined,
    end_date: str(o.end_date) || undefined,
  };
}

/** Read total record count from common pagination field names; avoid using page size as total. */
function pickProvidersListTotal(o: Record<string, unknown>): number | undefined {
  const read = (obj: Record<string, unknown>, keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined || v === null) continue;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return undefined;
  };
  const top = read(o, [
    "total",
    "totalCount",
    "total_count",
    "totalRecords",
    "total_records",
    "itemCount",
    "item_count",
  ]);
  if (top !== undefined) return top;
  if (o.meta && typeof o.meta === "object") {
    const nested = read(o.meta as Record<string, unknown>, ["total", "totalCount", "total_count"]);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

/** Unwrap GET /v1/providers/all (same general shape as admin provider list). */
export function normalizeProvidersAllResponse(data: unknown): AdminProviderListResponse {
  const mapRows = (rows: unknown[]): ProviderListItem[] =>
    rows.map((row) => normalizeProviderListItem(row));

  if (Array.isArray(data)) {
    const providers = mapRows(data);
    return {
      providers,
      total: data.length,
      page: 1,
      limit: data.length || 10,
    };
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const raw = o.providers ?? o.data ?? o.items ?? o.results;
    if (Array.isArray(raw)) {
      const explicitTotal = pickProvidersListTotal(o);
      const limit = Number(o.limit) || Number(o.pageSize) || Number(o.per_page) || 10;
      const page = Number(o.page) || Number(o.currentPage) || 1;
      /** 0 = total not provided; callers should use “full last page ⇒ may have more”. */
      const total = explicitTotal ?? 0;
      return {
        providers: mapRows(raw),
        total,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 10,
      };
    }
  }
  return { providers: [], total: 0, page: 1, limit: 10 };
}

/** UI status filter for provider list. Sent to API as uppercase (PENDING, ACTIVE, AVAILABLE, REJECTED, DEACTIVATED, ARCHIVED). */
export type ProviderListStatusFilter =
  | "all"
  | "pending"
  | "active"
  | "available"
  | "rejected"
  | "deactivated"
  | "archived";

/** Availability window type for admin provider list when status=AVAILABLE. Sent as DAILY | WEEKLY | MONTHLY. */
export type ProviderListAvailableTypeFilter = "daily" | "weekly" | "monthly";

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
  /** Assigned consultation-type level (admin verify API). */
  levelId?: number | null;
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
  /** Present when this SR belongs to a long-term opportunity (used by GET /service-event-logs/timeline). */
  longTermOpportunityId?: number | null;
}

/** Response for GET /v1/admin/service-requests. */
export interface AdminServiceRequestListResponse {
  data: AdminServiceRequestListDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * GET /v1/service-event-logs/timeline — single lifecycle entry.
 * Fields with `?:` are tolerated for backwards compatibility with the
 * old `/service-requests/:id/event-logs` payload shape.
 */
export interface ServiceRequestEventLogDto {
  id?: number;
  /** Canonical step code from the new timeline endpoint (e.g. REQUEST_CREATED). */
  step?: string | null;
  /** True when this lifecycle step has already happened. New endpoint only. */
  isDone?: boolean | null;
  /** Legacy fields kept for fallback rendering. */
  eventType?: string | null;
  title?: string | null;
  message?: string | null;
  description?: string | null;
  details?: string | null;
  comment?: string | null;
  note?: string | null;
  status?: string | null;
  label?: string | null;
  createdAt?: string | null;
  occurredAt?: string | null;
  timestamp?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  actorUserId?: number | null;
  performedBy?: string | null;
  [key: string]: unknown;
}

/** Full response of GET /v1/service-event-logs/timeline. */
export interface ServiceRequestTimelineResponseDto {
  serviceType: string;
  isTerminal: boolean;
  timeline: ServiceRequestEventLogDto[];
}

/** Normalize the new timeline response, tolerating common wrapper shapes. */
export function normalizeServiceRequestTimeline(
  raw: unknown
): ServiceRequestTimelineResponseDto {
  const empty: ServiceRequestTimelineResponseDto = {
    serviceType: "",
    isTerminal: false,
    timeline: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const root = raw as Record<string, unknown>;
  const body =
    root.timeline !== undefined
      ? root
      : root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const timelineRaw = Array.isArray(body.timeline) ? body.timeline : [];
  return {
    serviceType: typeof body.serviceType === "string" ? body.serviceType : "",
    isTerminal: Boolean(body.isTerminal),
    timeline: timelineRaw.filter(
      (x): x is ServiceRequestEventLogDto => !!x && typeof x === "object"
    ),
  };
}

/** Legacy: extract just the array (still used by old callers). */
export function normalizeServiceRequestEventLogs(raw: unknown): ServiceRequestEventLogDto[] {
  const parsed = normalizeServiceRequestTimeline(raw);
  if (parsed.timeline.length > 0) return parsed.timeline;
  if (Array.isArray(raw)) {
    return raw.filter((x) => x && typeof x === "object") as ServiceRequestEventLogDto[];
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const nested =
      o.data ??
      o.eventLogs ??
      o.logs ??
      o.events ??
      o.items ??
      o.content ??
      o.results;
    if (Array.isArray(nested)) {
      return nested.filter((x) => x && typeof x === "object") as ServiceRequestEventLogDto[];
    }
  }
  return [];
}

function eventLogSortTime(log: ServiceRequestEventLogDto): number {
  const s = log.occurredAt ?? log.createdAt ?? log.timestamp ?? "";
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : 0;
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

/** One profile onboarding checklist row (GET .../details `profileCheacklists`). */
export interface ProviderProfileChecklistItemDto {
  id: number;
  key: string;
  label: string;
  displayOrder: number;
  checked: boolean;
}

/** Full provider details: GET /v1/admin/providers/:providerId/details. Wallet fields per api_business_flow §11. */
export interface ProviderFullDetailsDto {
  user: AdminUserDetailUserDto;
  provider: ProviderFullProfileDto;
  /** Profile onboarding checklist (API property name includes the historical typo `cheacklists`). */
  profileCheacklists?: ProviderProfileChecklistItemDto[];
  /** Checklist services for this provider's consultation type; offered = true means provider offers it. */
  consultationTypeServices?: ProviderConsultationTypeServiceItemDto[];
  serviceRequestsByStatus: ServiceRequestsByStatusDto;
  wallet?: AdminWalletDetailDto | null;
  /** Total wallet balance (new wallet API §11). */
  totalBalance?: string | null;
  claimableBalance: string;
  /** USER wallet (cash + withdrawn online) — maps to mobile `walletBalance`. */
  walletBalance?: string | null;
  /** Non-claimable (cash) balance. */
  nonClaimableBalance?: string | null;
  /** Commission owed by provider for cash payments. */
  cashCommissionDue?: string | null;
  /** Pending withdrawal amount. */
  pendingWithdrawal?: string | null;
  /** Same aggregates as GET /financial/wallet/me `overview`. */
  walletOverview?: WalletOverviewDto | null;
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

/** Parse GET /admin/providers/:id/level JSON (raw or wrapped) into a level id, or null. */
export function parseAdminProviderLevelResponse(body: unknown): number | null {
  if (body == null) return null;
  if (typeof body === "number" && Number.isFinite(body)) return body;
  if (typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const asNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const fromObject = (obj: Record<string, unknown>): number | null => {
    const id = asNum(obj.levelId);
    if (id != null) return id;
    return asNum(obj.id);
  };
  const direct = fromObject(o);
  if (direct != null) return direct;
  const data = o.data;
  if (data && typeof data === "object") {
    const inner = fromObject(data as Record<string, unknown>);
    if (inner != null) return inner;
  }
  return null;
}

export const providersApi = {
  /**
   * GET /v1/admin/providers — List all provider profiles (providers table).
   * Role: ADMIN. Query: page, limit, consultationTypeId, status (PENDING | ACTIVE | AVAILABLE | REJECTED | DEACTIVATED | ARCHIVED).
   * When status=AVAILABLE: optional availableType (DAILY|WEEKLY|MONTHLY) and startDate/endDate (ISO).
   * Optional startDate/endDate (ISO): inclusive filter; single-day selection uses equal start/end.
   */
  getList: async (
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      consultationTypeId?: number;
      status?: ProviderListStatusFilter;
      documentType?: string;
      availableType?: ProviderListAvailableTypeFilter;
      supervisorId?: number;
      /** Inclusive date range filter (ISO strings). */
      startDate?: string;
      endDate?: string;
    },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    const search = params?.search?.trim();
    if (search) query.search = search;
    if (params?.consultationTypeId != null) {
      query.consultationTypeId = params.consultationTypeId;
    }
    if (params?.status && params.status !== "all") {
      query.status = params.status.toUpperCase();
    }
    if (params?.documentType != null && params.documentType !== "") {
      query.documentType = params.documentType;
    }
    if (params?.availableType) {
      query.availableType = params.availableType.toUpperCase();
    }
    if (params?.startDate != null && String(params.startDate).trim() !== "") {
      query.startDate = String(params.startDate).trim();
    }
    if (params?.endDate != null && String(params.endDate).trim() !== "") {
      query.endDate = String(params.endDate).trim();
    }
    if (params?.supervisorId != null && Number.isFinite(params.supervisorId) && params.supervisorId > 0) {
      query.supervisorId = params.supervisorId;
    }
    return httpService.get<AdminProviderListResponse>("/admin/providers", {
      params: query,
      signal: config?.signal,
    });
  },

  /**
   * GET /v1/providers/all — paginated providers (e.g. for supervisor nurse assignment).
   * Query: page, limit. Backend requires consultationTypeCode when isSupervised is sent.
   */
  getAllPublic: async (
    params?: { page?: number; limit?: number; consultationTypeCode?: string; search?: string },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number | boolean> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
      isSupervised: false,
      consultationTypeCode: params?.consultationTypeCode ?? "NURSING_CARE",
    };
    const search = params?.search?.trim();
    if (search) query.search = search;
    return httpService.get<unknown>("/providers/all", {
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
  /** GET /v1/providers/:providerId/availability?date=YYYY-MM-DD[&time=HH:mm&shiftDuration=n] */
  getAvailability: async (
    providerId: number,
    date: string,
    options?: { time?: string; shiftDuration?: number },
    config?: { signal?: AbortSignal }
  ) => {
    const params: Record<string, string | number> = { date };
    if (options?.time) params.time = options.time;
    if (options?.shiftDuration != null) params.shiftDuration = options.shiftDuration;
    return httpService.get<unknown>(`/providers/${providerId}/availability`, {
      params,
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
  /** PATCH /v1/admin/providers/:providerId/cheaklist — Set completed checklist items (IDs that are checked). */
  updateProfileChecklist: async (
    providerId: number,
    body: { checklistItemIds: number[] }
  ) => {
    return httpService.patch<ProviderProfileChecklistItemDto[]>(
      `/admin/providers/${providerId}/cheaklist`,
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

  /** GET /v1/certifications/provider/:providerId - List certifications (and linked documents) for this provider. */
  getCertifications: async (providerId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<AdminCertificationDto[]>(
      `/certifications/provider/${encodeURIComponent(String(providerId))}`,
      { signal: config?.signal }
    );
  },

  /** PATCH /v1/admin/providers/:providerId/verify - Set provider status. Allowed transitions: PENDING → Rejected/Active/Deactivated/Archived; ACTIVE → Pending/Rejected. */
  verifyProvider: async (
    providerId: number,
    data: {
      status: "PENDING" | "ACTIVE" | "REJECTED" | "DEACTIVATED" | "ARCHIVED";
      /** Consultation type level to assign (required by backend for verify). */
      levelId: number;
      comment?: string;
    },
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<ProviderFullProfileDto>(
      `/admin/providers/${providerId}/verify`,
      data,
      config
    );
  },

  /** PATCH /v1/admin/providers/:providerId/level — Set provider level only (no status change). */
  updateProviderLevel: async (
    providerId: number,
    data: { levelId: number },
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<ProviderFullProfileDto>(
      `/admin/providers/${providerId}/level`,
      data,
      config
    );
  },

  /**
   * GET /v1/admin/providers/:providerId/level — Current provider consultation type level.
   * Returns normalized `levelId` (null if unassigned or not present in payload).
   */
  getProviderLevel: async (providerId: number, config?: { signal?: AbortSignal }) => {
    const res = await httpService.get<unknown>(`/admin/providers/${providerId}/level`, {
      signal: config?.signal,
    });
    return { levelId: parseAdminProviderLevelResponse(res.data) };
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

  /**
   * GET /v1/service-requests/fee-estimate/short-term
   * Query: providerId, shiftDuration (hours), consultationTypeId
   */
  getShortTermFeeEstimate: async (
    params: {
      providerId: number;
      shiftDuration: number;
      consultationTypeId: number;
    },
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.get<ServiceRequestFeeEstimateResponse>(
      "/service-requests/fee-estimate/short-term",
      {
        params: {
          providerId: params.providerId,
          shiftDuration: params.shiftDuration,
          consultationTypeId: params.consultationTypeId,
        },
        signal: config?.signal,
      }
    );
  },
};

/** Unwrap fee-estimate payload (root or nested under `data`). */
export function normalizeServiceRequestFeeEstimate(
  raw: unknown
): ServiceRequestFeeEstimateResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const inner =
    o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : o;
  const subTotal = String(inner.subTotal ?? inner.sub_total ?? "").trim();
  if (!subTotal) return null;
  return {
    rateType: String(inner.rateType ?? inner.rate_type ?? "") || undefined,
    unitRate: String(inner.unitRate ?? inner.unit_rate ?? "") || undefined,
    shiftDuration: Number(inner.shiftDuration ?? inner.shift_duration) || undefined,
    serviceFee: String(inner.serviceFee ?? inner.service_fee ?? "") || undefined,
    subTotal,
    currency: String(inner.currency ?? "") || undefined,
    providerNet: String(inner.providerNet ?? inner.provider_net ?? "") || undefined,
  };
}

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
  /**
   * GET /financial/wallet/me — balances + provider `overview` stats.
   * Mobile: hero = `claimableBalance`; grid = `overview`; see `src/utils/providerWallet.ts`.
   */
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

  /**
   * GET /financial/withdrawal/admin/list
   * Query: page, limit, status, startDate, endDate
   */
  getWithdrawalAdminList: async (
    params?: {
      page?: number;
      limit?: number;
      status?: WithdrawalRequestStatus;
      startDate?: string;
      endDate?: string;
    },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    if (params?.status) query.status = params.status;
    if (params?.startDate) query.startDate = params.startDate;
    if (params?.endDate) query.endDate = params.endDate;
    return httpService.get<WithdrawalRequestListResponse>("/financial/withdrawal/admin/list", {
      params: query,
      signal: config?.signal,
    });
  },

  /** GET /financial/withdrawal/admin/:id */
  getWithdrawalAdminById: async (id: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<WithdrawalRequestDetail>(`/financial/withdrawal/admin/${id}`, {
      signal: config?.signal,
    });
  },

  /** PATCH /financial/withdrawal/admin/:id/approve */
  approveWithdrawalAdmin: async (
    id: number,
    data?: WithdrawalReviewPayload,
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<WithdrawalRequestDetail>(
      `/financial/withdrawal/admin/${id}/approve`,
      data ?? {},
      config
    );
  },

  /** PATCH /financial/withdrawal/admin/:id/reject */
  rejectWithdrawalAdmin: async (
    id: number,
    data?: WithdrawalReviewPayload,
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<WithdrawalRequestDetail>(
      `/financial/withdrawal/admin/${id}/reject`,
      data ?? {},
      config
    );
  },

  /** PATCH /financial/withdrawal/admin/:id/complete */
  completeWithdrawalAdmin: async (
    id: number,
    data?: WithdrawalCompletePayload,
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.patch<WithdrawalRequestDetail>(
      `/financial/withdrawal/admin/${id}/complete`,
      data ?? {},
      config
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

  /**
   * GET /v1/service-event-logs/timeline — timeline / lifecycle events for a service request
   * and/or its parent long-term opportunity. At least one id should be supplied; both
   * are passed when available so the backend can merge both timelines.
   */
  getEventLogs: async (
    params: { serviceRequestId?: number | null; longTermOpportunityId?: number | null },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, number> = {};
    if (params.serviceRequestId != null) query.serviceRequestId = Number(params.serviceRequestId);
    if (params.longTermOpportunityId != null)
      query.longTermOpportunityId = Number(params.longTermOpportunityId);
    return httpService.get<unknown>("/service-event-logs/timeline", {
      params: query,
      signal: config?.signal,
    });
  },
};

export function sortServiceRequestEventLogsAsc(logs: ServiceRequestEventLogDto[]): ServiceRequestEventLogDto[] {
  return [...logs].sort((a, b) => eventLogSortTime(a) - eventLogSortTime(b));
}

// ============== Admin long-term opportunities (service requests — nursing schedule pipeline) ==============

/** Status filter for GET /v1/admin/long-term-opportunities (omit for “all”). */
export type LongTermOpportunityStatusFilter =
  | "REQUESTED"
  | "SCHEDULE_PROPOSED"
  | "CHANGE_REQUESTED"
  | "IN_PROGRESS"
  | "PAYMENT_PENDING"
  | "PAID"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

/** GET /v1/service-requests/fee-estimate/short-term */
export interface ServiceRequestFeeEstimateResponse {
  rateType?: string;
  unitRate?: string;
  shiftDuration?: number;
  serviceFee?: string;
  vat?: { amount?: string; percent?: string; inclusive?: boolean };
  commission?: { amount?: string; percent?: string; inclusive?: boolean };
  ait?: { amount?: string; percent?: string };
  providerNet?: string;
  subTotal?: string;
  currency?: string;
}

export interface LongTermOpportunityListItem {
  id: number;
  status: string;
  requestNo?: string | null;
  patientName?: string | null;
  caregiverCategory?: string | null;
  location?: string | null;
  amount?: string | null;
  consultationTypeId?: number | null;
  preferredStartTime?: string | null;
  shiftDurationHours?: number | null;
  timeRange?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  assignedNursesLabel?: string | null;
  supervisorId?: number | null;
  supervisorName?: string | null;
  createdAt?: string | null;
}

function strOpt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function computeTimeRange(preferredStartTime: string | null, shiftDurationHours: number | null): string | null {
  if (!preferredStartTime || !Number.isFinite(shiftDurationHours) || (shiftDurationHours ?? 0) <= 0) {
    return null;
  }
  const durationHours = Number(shiftDurationHours);
  const normalized = preferredStartTime.trim().toUpperCase();
  const m = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  const meridiem = m[3];
  if (!Number.isFinite(hour) || hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  const startMinutes = hour * 60 + minute;
  const endMinutes = (startMinutes + Math.round(durationHours * 60)) % (24 * 60);
  const fmt = (mins: number) => {
    const h24 = Math.floor(mins / 60);
    const mm = mins % 60;
    const isPm = h24 >= 12;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${isPm ? "PM" : "AM"}`;
  };
  return `${fmt(startMinutes)} - ${fmt(endMinutes)}`;
}

/** Map one row from GET /admin/long-term-opportunities (handles nested patient/user and snake_case). */
export function normalizeLongTermOpportunityRow(raw: unknown): LongTermOpportunityListItem {
  if (!raw || typeof raw !== "object") {
    return { id: 0, status: "" };
  }
  const o = raw as Record<string, unknown>;
  const patient =
    o.patient && typeof o.patient === "object" ? (o.patient as Record<string, unknown>) : null;
  const id = Number(o.id ?? o.serviceRequestId ?? o.service_request_id);
  const status = String(o.status ?? "").toUpperCase();

  const patientName =
    strOpt(o.patientName) ??
    strOpt(o.patient_name) ??
    (patient
      ? [strOpt(patient.firstName), strOpt(patient.lastName)].filter(Boolean).join(" ").trim() || null
      : null) ??
    strOpt(patient?.name);

  const requestNo =
    strOpt(o.requestNo) ??
    strOpt(o.request_no) ??
    strOpt(o.referenceNo) ??
    strOpt(o.code) ??
    (Number.isFinite(id) && id > 0 ? `SR-${id}` : null);

  const location =
    strOpt(o.serviceAddressText) ??
    strOpt(o.service_address_text) ??
    strOpt(o.location) ??
    strOpt(o.address) ??
    strOpt(o.serviceAddress) ??
    strOpt(o.service_address);

  const startDate = strOpt(o.startDate ?? o.start_date ?? o.requestedStartDate ?? o.windowStart);
  const endDate = strOpt(o.endDate ?? o.end_date ?? o.requestedEndDate ?? o.windowEnd);
  const preferredStartTime = strOpt(o.preferredStartTime ?? o.preferred_start_time);
  const shiftDurationHoursRaw = o.shiftDurationHours ?? o.shift_duration_hours;
  const shiftDurationHours =
    shiftDurationHoursRaw == null ? null : Number.isFinite(Number(shiftDurationHoursRaw)) ? Number(shiftDurationHoursRaw) : null;
  const timeRange = computeTimeRange(preferredStartTime, shiftDurationHours);

  let assignedNursesLabel: string | null = null;
  const an = o.assignedNurses ?? o.assigned_nurses;
  if (Array.isArray(an)) {
    const names = an
      .map((r) => {
        if (!r || typeof r !== "object") return "";
        const x = r as Record<string, unknown>;
        const u = x.user && typeof x.user === "object" ? (x.user as Record<string, unknown>) : null;
        const n =
          [strOpt(x.firstName), strOpt(x.lastName)].filter(Boolean).join(" ").trim() ||
          strOpt(x.name) ||
          (u
            ? [strOpt(u.firstName), strOpt(u.lastName)].filter(Boolean).join(" ").trim() ||
              strOpt(u.name)
            : "");
        return n;
      })
      .filter(Boolean);
    if (names.length) assignedNursesLabel = names.join(", ");
  } else if (typeof an === "string" && an.trim()) {
    assignedNursesLabel = an.trim();
  }

  const supervisor =
    o.supervisor && typeof o.supervisor === "object"
      ? (o.supervisor as Record<string, unknown>)
      : null;
  const supervisorIdRaw = o.supervisorId ?? o.supervisor_id ?? supervisor?.id;
  const supervisorIdNum = Number(supervisorIdRaw);
  const supervisorId =
    Number.isFinite(supervisorIdNum) && supervisorIdNum > 0 ? supervisorIdNum : null;
  const supervisorName =
    strOpt(o.supervisorName) ??
    strOpt(o.supervisor_name) ??
    (supervisor
      ? [strOpt(supervisor.firstName), strOpt(supervisor.lastName)].filter(Boolean).join(" ").trim() ||
        strOpt(supervisor.name) ||
        strOpt(supervisor.email)
      : null);

  const consultationTypeIdRaw = o.consultationTypeId ?? o.consultation_type_id;
  const consultationTypeId = Number(consultationTypeIdRaw);
  const consultationTypeIdNorm =
    Number.isFinite(consultationTypeId) && consultationTypeId > 0 ? consultationTypeId : null;

  const consultationType =
    o.consultationType && typeof o.consultationType === "object"
      ? (o.consultationType as Record<string, unknown>)
      : null;
  const caregiverCategory =
    strOpt(o.caregiverCategory) ??
    strOpt(o.caregiver_category) ??
    strOpt(consultationType?.caregiverCategory) ??
    strOpt(consultationType?.caregiver_category) ??
    strOpt(consultationType?.name) ??
    strOpt(o.consultationTypeName) ??
    strOpt(o.consultation_type_name);

  return {
    id: Number.isFinite(id) && id > 0 ? id : 0,
    status,
    requestNo,
    patientName,
    caregiverCategory,
    location,
    amount: strOpt(o.fee ?? o.amount ?? o.totalFee ?? o.total_fee),
    consultationTypeId: consultationTypeIdNorm,
    preferredStartTime,
    shiftDurationHours,
    timeRange,
    startDate,
    endDate,
    assignedNursesLabel,
    supervisorId,
    supervisorName,
    createdAt: strOpt(o.createdAt ?? o.created_at),
  };
}

export function normalizeLongTermOpportunitiesListResponse(data: unknown): {
  items: LongTermOpportunityListItem[];
  total: number;
  page: number;
  limit: number;
} {
  const unwrapRows = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      for (const key of ["data", "items", "results", "opportunities", "longTermOpportunities"] as const) {
        if (Array.isArray(o[key])) return o[key] as unknown[];
      }
    }
    return [];
  };

  const top =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const rows = Array.isArray(data) ? data : unwrapRows(data);
  const items = rows.map((row) => normalizeLongTermOpportunityRow(row));

  const page = Number(top?.page ?? top?.currentPage ?? 1);
  const limit = Number(top?.limit ?? top?.pageSize ?? 10);
  const total =
    typeof top?.total === "number"
      ? top.total
      : typeof top?.totalCount === "number"
        ? top.totalCount
        : typeof top?.total_count === "number"
          ? top.total_count
          : items.length;

  return {
    items,
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
  };
}

export const adminLongTermOpportunitiesApi = {
  /**
   * GET /v1/admin/long-term-opportunities — Paginated long-term service requests.
   * Query: page, limit; optional status (omit for all), search (free-text).
   */
  getList: async (
    params?: {
      page?: number;
      limit?: number;
      status?: LongTermOpportunityStatusFilter;
      search?: string;
    },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
    };
    if (params?.status) query.status = params.status;
    const search = params?.search?.trim();
    if (search) query.search = search;
    return httpService.get<unknown>("/admin/long-term-opportunities", {
      params: query,
      signal: config?.signal,
    });
  },

  /** GET /v1/admin/long-term-opportunities/:id — single service request/opportunity details. */
  getById: async (id: string | number, config?: { signal?: AbortSignal }) => {
    return httpService.get<unknown>(`/admin/long-term-opportunities/${id}`, {
      signal: config?.signal,
    });
  },

  /** GET /v1/long-term-opportunities/schedule-details/:id — opportunity + schedule detail payload. */
  getScheduleDetails: async (id: string | number, config?: { signal?: AbortSignal }) => {
    return httpService.get<unknown>(`/long-term-opportunities/schedule-details/${id}`, {
      signal: config?.signal,
      // Bust browser/CDN caches so refresh always matches server after creates/updates.
      params: { _t: Date.now() },
    });
  },

  /**
   * POST /v1/long-term-opportunities/:id/provider-schedule
   * Create provider schedule slot(s) for a long-term opportunity.
   */
  createProviderSchedule: async (
    id: string | number,
    body: {
      slots: Array<{
        providerId: number;
        date: string; // YYYY-MM-DD
        startTime: string; // HH:mm
        endTime: string; // HH:mm
      }>;
    }
  ) => {
    return httpService.post<unknown>(`/long-term-opportunities/${id}/provider-schedule`, body);
  },

  /**
   * PATCH /v1/long-term-opportunities/:id/schedule-reject/:scheduleSlotId
   * Remove/reject a scheduled slot from long-term opportunity calendar.
   */
  rejectScheduleSlot: async (
    id: string | number,
    scheduleSlotId: string | number,
    body: { reason: string }
  ) => {
    return httpService.patch<unknown>(
      `/long-term-opportunities/${id}/schedule-reject/${scheduleSlotId}`,
      body
    );
  },

  /** PATCH /v1/long-term-opportunities/:id — Update long-term opportunity. */
  updateOpportunity: async (
    id: string | number,
    body: Record<string, unknown>
  ) => {
    return httpService.patch<unknown>(`/long-term-opportunities/${id}`, body);
  },

  /** PUT /v1/admin/long-term-opportunities/:id/supervisor — Assign supervisor to opportunity. */
  assignSupervisor: async (id: string | number, body: { supervisorId: number }) => {
    return httpService.put<unknown>(`/admin/long-term-opportunities/${id}/supervisor`, body);
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

type StoredAuthUser = {
  id?: number | string;
  role?: string;
};

function getStoredAuthUser(): StoredAuthUser | null {
  // Prefer localStorage (remember me), then fallback to sessionStorage.
  const raw =
    localStorage.getItem("auth_user") ??
    sessionStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuthUser;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
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
    const authUser = getStoredAuthUser();
    const role = String(authUser?.role ?? "").toUpperCase();
    const supervisorId = Number(authUser?.id);
    const params =
      role === "SUPERVISOR" && Number.isFinite(supervisorId) && supervisorId > 0
        ? { supervisorId }
        : undefined;

    const res = await httpService.get<unknown>("/admin/dashboard/summary", {
      signal: config?.signal,
      params,
    });
    return { ...res, data: normalizeDashboardSummary(res.data) };
  },
};

// ============== Admin Supervisors API ==============

/** One row from GET /v1/admin/supervisors (field names may vary slightly by backend). */
export interface AdminSupervisorDto {
  id: number;
  userId?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  phone?: string | null;
  region?: string | null;
  teamSize?: number | null;
  status?: string | null;
  joinedAt?: string | null;
  createdAt?: string | null;
  isActive?: boolean;
}

/** Unwrap array from common response shapes. */
export function normalizeAdminSupervisorsResponse(data: unknown): AdminSupervisorDto[] {
  return normalizeAdminSupervisorsListResponse(data).supervisors;
}

export interface AdminSupervisorsListResponse {
  supervisors: AdminSupervisorDto[];
  total: number;
  page: number;
  limit: number;
}

/** Unwrap GET /v1/admin/supervisors with pagination metadata. */
export function normalizeAdminSupervisorsListResponse(data: unknown): AdminSupervisorsListResponse {
  const mapRows = (rows: unknown[]): AdminSupervisorDto[] => rows as AdminSupervisorDto[];

  if (Array.isArray(data)) {
    return {
      supervisors: mapRows(data),
      total: data.length,
      page: 1,
      limit: data.length || 10,
    };
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["supervisors", "data", "items", "results"] as const) {
      const arr = o[key];
      if (Array.isArray(arr)) {
        const explicitTotal = pickProvidersListTotal(o);
        const limit = Number(o.limit) || Number(o.pageSize) || Number(o.per_page) || 10;
        const page = Number(o.page) || Number(o.currentPage) || 1;
        return {
          supervisors: mapRows(arr),
          total: explicitTotal ?? 0,
          page: Number.isFinite(page) ? page : 1,
          limit: Number.isFinite(limit) ? limit : 10,
        };
      }
    }
  }
  return { supervisors: [], total: 0, page: 1, limit: 10 };
}

/** Payload used by assign/reassign supervisor-provider endpoints. */
export interface AssignProvidersToSupervisorRequest {
  supervisorId: number;
  providerIds: number[];
}

/** One row from GET /v1/admin/:supervisorId/providers (shape can vary by backend). */
export interface AssignedProviderRow {
  id?: number;
  providerId?: number;
  provider_id?: number;
  [key: string]: unknown;
}

/** Raw rows from GET /v1/admin/:supervisorId/providers (array or wrapped envelope). */
export function assignedProvidersRowsFromResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["providers", "assignedProviders", "data", "items", "results"] as const) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return [];
}

/** Extract assigned provider IDs from common response envelopes and key names. */
export function normalizeAssignedProviderIdsResponse(data: unknown): number[] {
  const rows = assignedProvidersRowsFromResponse(data);
  const ids = rows
    .map((row) => {
      if (!row || typeof row !== "object") return NaN;
      const o = row as AssignedProviderRow;
      const rawId = o.providerId ?? o.provider_id ?? o.id;
      const id = Number(rawId);
      return Number.isFinite(id) && id > 0 ? id : NaN;
    })
    .filter((id) => Number.isFinite(id)) as number[];
  return Array.from(new Set(ids));
}

/** Full rows as list items (for UI merge with GET /providers/all). */
export function normalizeAssignedProvidersToListItems(data: unknown): ProviderListItem[] {
  return assignedProvidersRowsFromResponse(data).map((row) => normalizeProviderListItem(row));
}

export const adminSupervisorsApi = {
  /** GET /v1/admin/supervisors — list supervisors (admin). Optional search and pagination. */
  getAll: async (
    params?: { page?: number; limit?: number; search?: string },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    };
    const search = params?.search?.trim();
    if (search) query.search = search;
    return httpService.get<unknown>("/admin/supervisors", {
      params: query,
      signal: config?.signal,
    });
  },

  /** GET /v1/admin/:supervisorId/providers — already assigned providers under a supervisor. */
  getAssignedProviders: async (supervisorId: number, config?: { signal?: AbortSignal }) => {
    return httpService.get<unknown>(`/admin/${supervisorId}/providers`, { signal: config?.signal });
  },

  /** POST /v1/admin/assign-providers */
  assignProviders: async (data: AssignProvidersToSupervisorRequest) => {
    return httpService.post<{ message?: string }>("/admin/assign-providers", data);
  },

  /** PUT /v1/admin/reassign-providers — replace supervisor's assigned providers list. */
  reassignProviders: async (data: AssignProvidersToSupervisorRequest) => {
    return httpService.put<{ message?: string }>("/admin/reassign-providers", data);
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
  /** balance − netChange, must be 0 */
  drift: string;
  isHealthy: boolean;
}

export interface GlMoneySummaryDto {
  /** SERVICE_HOLD_GL — payments held in escrow until service completes */
  inEscrow: string;
  /** COMMISSION_GL — platform commission earned (released at completion) */
  commissionEarned: string;
  /** VAT_GL — tax collected on service fees */
  taxCollected: string;
  /** AIT_GL — advance income tax withheld from provider earnings */
  aitWithheld: string;
  /** commission + tax + cancellation fees — total direct platform revenue */
  totalPlatformRevenue: string;
  /** PAYOUT_GL — cumulative provider withdrawals processed */
  providerPayoutsProcessed: string;
  /** REFUND_GL — staged refunds awaiting gateway disbursement */
  stagedRefunds: string;
  /** CANCELLATION_FEE_GL — cancellation fee revenue collected */
  cancellationFees: string;
  /** Total supervisor commission released to assigned supervisors' CLAIMABLE wallets on completion.
   *  When no supervisor is assigned the amount goes to COMMISSION_GL and is already in commissionEarned. */
  supervisorCommissionReleased: string;
}


export interface GlReconciliationHealthDto {
  balanced: boolean;
  driftedRowCount: number;
  imbalancedTransactionCount: number;
  strictModeCutoverAt: string | null;
  legacyDriftedRowCount: number;
  legacyImbalancedTransactionCount: number;
}

export interface GlReconciliationSummaryResponseDto {
  wallets: GlWalletReconciliationDto[];
  moneySummary: GlMoneySummaryDto;
  reconciliationHealth: GlReconciliationHealthDto;
}

export interface GlDailyFlowEntryDto {
  date: string;
  totalCredit: string;
  totalDebit: string;
  netChange: string;
  wallets: Array<{
    walletType: string;
    walletId: number | null;
    balance: string;
    currency: string;
    totalCredit: string;
    totalDebit: string;
    netChange: string;
  }>;
}

export interface GlDailyFlowResponseDto {
  startDate: string;
  endDate: string;
  days: GlDailyFlowEntryDto[];
  total: { totalCredit: string; totalDebit: string; netChange: string };
}

// ============== Admin Financial Report (combined) ==============

export type FinancialTxType =
  | "CONSULTATION_PAYMENT"
  | "WITHDRAWAL"
  | "REFUND"
  | "COMMISSION"
  | "ADJUSTMENT";
export type FinancialPaymentMethod = "ONLINE" | "CASH";
export type FinancialServiceType = "SHORT_TERM" | "LONG_TERM";
export type FinancialTxStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface FinancialReportFiltersDto {
  startDate: string;
  endDate: string;
  providerId: number | null;
  patientId: number | null;
  type: FinancialTxType | null;
  paymentMethod: FinancialPaymentMethod | null;
  serviceType: FinancialServiceType | null;
  status: FinancialTxStatus | null;
}

export interface FinancialReportTotalsDto {
  onlinePayments: string;
  cashPayments: string;
  totalInflow: string;
  /**
   * Amount earmarked to provider CLAIMABLE wallets in the period — snapshot.
   * NOT yet withdrawn. For online payments, the money is still in escrow
   * (SERVICE_HOLD_GL) until the service is COMPLETED; only then does it
   * actually appear in provider CLAIMABLE. See liveBalances for realized.
   * Renamed from `totalProviderFee`.
   */
  totalProviderEarningsAllocated: string;
  totalCommission: string;
  totalTax: string;
  totalAit: string;
  totalWithdrawals: string;
  netPlatformEarnings: string;
  consultationCount: number;
  withdrawalCount: number;
}

export interface FinancialReportDayDto {
  date: string;
  inflow: { onlinePayments: string; cashPayments: string; total: string };
  distribution: {
    /** Renamed from `providerFee`. Allocated, NOT withdrawn. */
    providerEarningsAllocated: string;
    commission: string;
    tax: string;
    ait: string;
  };
  outflow: { withdrawals: string };
  transactionCount: number;
}

export interface FinancialReportSummaryDto {
  totals: FinancialReportTotalsDto;
  byDay: FinancialReportDayDto[];
}

export interface FinancialReportTxItemDto {
  transactionId: number;
  date: string;
  type: FinancialTxType;
  status: FinancialTxStatus;
  paymentMethod: FinancialPaymentMethod | null;
  serviceType: FinancialServiceType | null;
  longTermOpportunityId: number | null;
  consultationTypeName: string | null;
  scheduledDate: string | null;
  providerId: number | null;
  providerName: string | null;
  patientId: number | null;
  patientName: string | null;
  totalFee: string | null;
  providerFee: string | null;
  commission: string | null;
  tax: string | null;
  ait: string | null;
  supervisorCommission: string | null;
  isEscrow: boolean;
}

export interface FinancialReportPaginationDto {
  page: number;
  limit: number;
  hasMore: boolean;
  total: number | null;
}

export interface FinancialReportTxListDto {
  data: FinancialReportTxItemDto[];
  pagination: FinancialReportPaginationDto;
}

export interface FinancialReportResponseDto {
  filters: FinancialReportFiltersDto;
  summary: FinancialReportSummaryDto | null;
  transactions: FinancialReportTxListDto;
}

// ===== transaction detail =====

export interface FinancialTxDetailBreakdownPart {
  amount: string;
  percent: string;
  inclusive: boolean;
}

export interface FinancialTxDetailBreakdownDto {
  totalFee: string;
  tax: FinancialTxDetailBreakdownPart;
  supervisorCommission: { amount: string; percent: string };
  commission: FinancialTxDetailBreakdownPart;
  ait: FinancialTxDetailBreakdownPart;
  providerFee: string;
}

export interface FinancialTxDetailServiceRequestDto {
  id: number;
  status: string;
  scheduledDate: string | null;
  rateType: string | null;
  rate: string | null;
  shiftDuration: number | null;
  referenceType: FinancialServiceType | null;
  longTermOpportunityId: number | null;
}

export interface FinancialTxDetailPartyDto {
  id: number;
  name: string | null;
  email: string | null;
}

export interface FinancialTxDetailLedgerEntryDto {
  ledgerId: number;
  debitWalletType: string;
  creditWalletType: string;
  amount: string;
  debitBalanceBefore: string | null;
  debitBalanceAfter: string;
  creditBalanceBefore: string | null;
  creditBalanceAfter: string;
  description: string | null;
}

export interface FinancialTxDetailResponseDto {
  transactionId: number;
  type: FinancialTxType;
  status: FinancialTxStatus;
  paymentMethod: FinancialPaymentMethod | null;
  amount: string;
  createdAt: string;
  serviceRequest: FinancialTxDetailServiceRequestDto | null;
  consultationTypeName: string | null;
  patient: FinancialTxDetailPartyDto | null;
  provider: FinancialTxDetailPartyDto | null;
  breakdown: FinancialTxDetailBreakdownDto | null;
  ledgerEntries: FinancialTxDetailLedgerEntryDto[];
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
  /**
   * Combined admin financial report (summary + paginated transaction list).
   * Mandatory date range, max 90 days. Pass `paginationOnly: true` on page 2+
   * to skip the summary recomputation (significant cost saver at scale).
   * Pass `includeTotal: true` to opt into the COUNT(*) query.
   */
  getFinancialReport: async (
    params: {
      startDate: string;
      endDate: string;
      providerId?: number;
      patientId?: number;
      type?: FinancialTxType;
      paymentMethod?: FinancialPaymentMethod;
      serviceType?: FinancialServiceType;
      status?: FinancialTxStatus;
      page?: number;
      limit?: number;
      paginationOnly?: boolean;
      includeTotal?: boolean;
    },
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number | boolean> = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.providerId != null)    query.providerId    = params.providerId;
    if (params.patientId != null)     query.patientId     = params.patientId;
    if (params.type)                  query.type          = params.type;
    if (params.paymentMethod)         query.paymentMethod = params.paymentMethod;
    if (params.serviceType)           query.serviceType   = params.serviceType;
    if (params.status)                query.status        = params.status;
    if (params.page != null)          query.page          = params.page;
    if (params.limit != null)         query.limit         = params.limit;
    if (params.paginationOnly)        query.paginationOnly = true;
    if (params.includeTotal)          query.includeTotal   = true;
    return httpService.get<FinancialReportResponseDto>("/admin/financial/report", {
      params: query,
      signal: config?.signal,
    });
  },
  getFinancialTransactionDetail: async (
    transactionId: number,
    config?: { signal?: AbortSignal }
  ) => {
    return httpService.get<FinancialTxDetailResponseDto>(
      `/admin/financial/transactions/${transactionId}`,
      { signal: config?.signal }
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

/** GET /v1/users/:id — single user (camelCase or snake_case from backend). */
export interface UserByIdDto {
  id: number;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  isActive?: boolean;
  phone?: string | null;
  mobileNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeUserByIdResponse(data: unknown): UserByIdDto | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.user && typeof o.user === "object") return normalizeUserByIdResponse(o.user);
  if (o.data && typeof o.data === "object") return normalizeUserByIdResponse(o.data);
  return data as UserByIdDto;
}

export const userApi = {
  /** GET /v1/users/:userId */
  getProfile: async (userId: string, config?: { signal?: AbortSignal }) => {
    return httpService.get<unknown>(`/users/${userId}`, { signal: config?.signal });
  },
  updateProfile: async (userId: string, data: Record<string, unknown>) => {
    return httpService.put(`/users/${userId}`, data);
  },
  deleteUser: async (userId: string) => {
    return httpService.delete(`/users/${userId}`);
  },
};

// ============== Admin / Supervisor Reporting ==============

/** Service request flavor used as a reporting filter. */
export type ReportingServiceType = "SHORT_TERM" | "LONG_TERM";

/** Provider category used as a reporting filter. */
export type ReportingProviderCategory = "DOCTOR" | "CAREGIVER" | "NURSE";

/** Query params for GET /v1/reporting/summary. All fields optional. */
export interface ReportingSummaryParams {
  /** Start date — `YYYY-MM-DD` (inclusive). */
  startDate?: string;
  /** End date — `YYYY-MM-DD` (inclusive). */
  endDate?: string;
  serviceType?: ReportingServiceType;
  providerCategory?: ReportingProviderCategory;
  providerId?: number;
  supervisorId?: number;
  /** Server-side row cap for ancillary breakdowns. Defaults vary by backend. */
  limit?: number;
}

/**
 * Response of GET /v1/reporting/summary.
 * Money fields are decimal strings (e.g. "147500.00"); rates are 0–100 numbers.
 */
export interface ReportingSummaryDto {
  fulfillmentRate: number | null;
  acceptanceRate: number | null;
  paymentExpiryRate: number | null;
  cancellationRate: number | null;
  totalRequests: number | null;
  confirmedBookings: number | null;
  completedServices: number | null;
  grossRevenue: string | null;
  ontorCommission: string | null;
  providerPayout: string | null;
  pendingPayout: string | null;
  refundAmount: string | null;
}

/**
 * Single row in GET /v1/reporting/daily-breakdown.
 * Money fields are decimal strings; counts and rates are numeric.
 */
export interface ReportingDailyBreakdownRow {
  /** Day in `YYYY-MM-DD` (Bangladesh calendar). */
  date: string;
  fulfillmentRate?: number | null;
  acceptanceRate?: number | null;
  paymentExpiryRate?: number | null;
  cancellationRate?: number | null;
  totalRequests?: number | null;
  confirmedBookings?: number | null;
  completedServices?: number | null;
  grossRevenue?: string | number | null;
  ontorCommission?: string | number | null;
  providerPayout?: string | number | null;
  pendingPayout?: string | number | null;
  refundAmount?: string | number | null;
}

/** Cursor-paginated response of GET /v1/reporting/daily-breakdown. */
export interface ReportingDailyBreakdownResponse {
  data: ReportingDailyBreakdownRow[];
  nextCursor?: string | null;
  hasMore?: boolean;
  limit?: number;
}

/** Extends summary params with a forward-only `cursor` for paginated breakdown calls. */
export interface ReportingDailyBreakdownParams extends ReportingSummaryParams {
  cursor?: string;
}

export const reportingApi = {
  /** GET /v1/reporting/summary — KPI summary for admin/supervisor reporting dashboard. */
  getSummary: async (
    params?: ReportingSummaryParams,
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {};
    if (params?.startDate) query.startDate = params.startDate;
    if (params?.endDate) query.endDate = params.endDate;
    if (params?.serviceType) query.serviceType = params.serviceType;
    if (params?.providerCategory) query.providerCategory = params.providerCategory;
    if (params?.providerId != null) query.providerId = params.providerId;
    if (params?.supervisorId != null) query.supervisorId = params.supervisorId;
    if (params?.limit != null) query.limit = params.limit;
    return httpService.get<ReportingSummaryDto>("/reporting/summary", {
      params: query,
      signal: config?.signal,
    });
  },
  /** GET /v1/reporting/daily-breakdown — cursor-paginated per-day breakdown. */
  getDailyBreakdown: async (
    params?: ReportingDailyBreakdownParams,
    config?: { signal?: AbortSignal }
  ) => {
    const query: Record<string, string | number> = {};
    if (params?.startDate) query.startDate = params.startDate;
    if (params?.endDate) query.endDate = params.endDate;
    if (params?.serviceType) query.serviceType = params.serviceType;
    if (params?.providerCategory) query.providerCategory = params.providerCategory;
    if (params?.providerId != null) query.providerId = params.providerId;
    if (params?.supervisorId != null) query.supervisorId = params.supervisorId;
    if (params?.limit != null) query.limit = params.limit;
    if (params?.cursor) query.cursor = params.cursor;
    return httpService.get<ReportingDailyBreakdownResponse>(
      "/reporting/daily-breakdown",
      { params: query, signal: config?.signal }
    );
  },
};

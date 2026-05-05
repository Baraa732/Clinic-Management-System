export enum UserRole {
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  CLINIC_ADMIN = 'clinic_admin',
  SECRETARY = 'secretary',
}

export enum ClientType {
  MOBILE_DOCTOR = 'mobile_doctor',
  MOBILE_PATIENT = 'mobile_patient',
  WEB_ADMIN = 'web_admin',
  WEB_SECRETARY = 'web_secretary',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification',
}

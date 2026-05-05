export type OrgType = "school" | "rec_center" | "summer_camp" | "other";
export type Frequency =
  | "one_off"
  | "weekly"
  | "multi_week"
  | "camp_week"
  | "other";
export type StudentCountBucket = "1-15" | "16-30" | "31-60" | "60+";
export type AgeRange = "K-2" | "3-5" | "6-8" | "9-12" | "Mixed";

export interface SchoolsLeadFormData {
  orgName: string;
  contactName: string;
  email: string;
  phone?: string;
  role?: string;
  orgType: OrgType | "";
  studentCount: StudentCountBucket | "";
  ageRange: AgeRange | "";
  frequency: Frequency | "";
  preferredDates?: string;
  location?: string;
  notes?: string;

  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
}

export type SchoolsLeadValidationErrors = Partial<
  Record<
    | "orgName"
    | "contactName"
    | "email"
    | "phone"
    | "orgType"
    | "studentCount"
    | "ageRange"
    | "frequency",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ORG_TYPES: OrgType[] = ["school", "rec_center", "summer_camp", "other"];
const FREQUENCIES: Frequency[] = [
  "one_off",
  "weekly",
  "multi_week",
  "camp_week",
  "other",
];
const STUDENT_BUCKETS: StudentCountBucket[] = ["1-15", "16-30", "31-60", "60+"];
const AGE_RANGES: AgeRange[] = ["K-2", "3-5", "6-8", "9-12", "Mixed"];

export function validateSchoolsLeadForm(
  data: Partial<SchoolsLeadFormData>,
): SchoolsLeadValidationErrors {
  const errors: SchoolsLeadValidationErrors = {};

  if (!data.orgName?.trim()) {
    errors.orgName = "Organization name is required";
  }
  if (!data.contactName?.trim()) {
    errors.contactName = "Your name is required";
  }
  if (!data.email?.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors.email = "Please enter a valid email";
  }
  if (data.phone && data.phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Please enter a valid 10-digit phone number";
  }
  if (!data.orgType || !ORG_TYPES.includes(data.orgType as OrgType)) {
    errors.orgType = "Please select an organization type";
  }
  if (
    !data.studentCount ||
    !STUDENT_BUCKETS.includes(data.studentCount as StudentCountBucket)
  ) {
    errors.studentCount = "Please select an approximate group size";
  }
  if (!data.ageRange || !AGE_RANGES.includes(data.ageRange as AgeRange)) {
    errors.ageRange = "Please select an age range";
  }
  if (!data.frequency || !FREQUENCIES.includes(data.frequency as Frequency)) {
    errors.frequency = "Please select a frequency";
  }

  return errors;
}

// Form-display labels — long and descriptive, used in <option> text.
export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  school: "School (public, private, charter)",
  rec_center: "Rec Center",
  summer_camp: "Summer Camp",
  other: "Other",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_off: "One-off clinic / single day",
  weekly: "Weekly residency (4+ weeks)",
  multi_week: "Multi-week unit (2-3 weeks)",
  camp_week: "Full camp week (M-F)",
  other: "Something else",
};

export const STUDENT_BUCKET_LABELS: Record<StudentCountBucket, string> = {
  "1-15": "1–15 students",
  "16-30": "16–30 students",
  "31-60": "31–60 students",
  "60+": "60+ students",
};

export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  "K-2": "Grades K–2 (ages 5–7)",
  "3-5": "Grades 3–5 (ages 8–10)",
  "6-8": "Grades 6–8 (ages 11–13)",
  "9-12": "Grades 9–12 (ages 14–18)",
  Mixed: "Mixed ages",
};

// Short canonical labels — used as Notion select option names + email subjects.
// Must exactly match the option names predefined when the Notion DB was created.
export const ORG_TYPE_NOTION: Record<OrgType, string> = {
  school: "School",
  rec_center: "Rec Center",
  summer_camp: "Summer Camp",
  other: "Other",
};

export const FREQUENCY_NOTION: Record<Frequency, string> = {
  one_off: "One-off Clinic",
  weekly: "Weekly Residency",
  multi_week: "Multi-Week Unit",
  camp_week: "Camp Week",
  other: "Other",
};

export const STUDENT_BUCKET_NOTION: Record<StudentCountBucket, string> = {
  "1-15": "1-15",
  "16-30": "16-30",
  "31-60": "31-60",
  "60+": "60+",
};

export const AGE_RANGE_NOTION: Record<AgeRange, string> = {
  "K-2": "K-2",
  "3-5": "3-5",
  "6-8": "6-8",
  "9-12": "9-12",
  Mixed: "Mixed",
};

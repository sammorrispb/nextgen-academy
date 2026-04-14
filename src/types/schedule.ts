import type { BallColor } from "@/data/levels";

/** Raw event from CourtReserve eventlist API */
export interface CREvent {
  Id: number;
  EventName: string;
  EventCategoryName: string;
  StartDateTime: string;
  EndDateTime: string;
  MaxRegistrants: number;
  RegisteredCount: number;
  WaitlistCount: number;
  PublicEventUrl: string | null;
  IsCanceled: boolean;
}

/** CR API response envelope */
export interface CRResponse {
  IsSuccessStatusCode: boolean;
  Data: CREvent[];
  ErrorMessage?: string;
}

/** A single upcoming session date */
export interface LiveSession {
  date: string;
  displayDate: string;
  /** ISO 8601 start datetime (from CR StartDateTime) — used for SportsEvent schema */
  startIso: string;
  /** ISO 8601 end datetime (from CR EndDateTime) — used for SportsEvent schema */
  endIso: string;
  level: BallColor;
  spotsTotal: number;
  spotsFilled: number;
  spotsRemaining: number;
  registrationUrl: string;
}

/** Sessions grouped by recurring time slot */
export interface LiveSlot {
  dayOfWeek: string;
  timeRange: string;
  levels: BallColor[];
  sessions: LiveSession[];
}

/** A location with its live schedule */
export interface LiveLocation {
  location: string;
  venue: string;
  address: string;
  slots: LiveSlot[];
}

/** Full schedule data returned to the page */
export interface LiveScheduleData {
  locations: LiveLocation[];
  fetchedAt: string;
  isLive: boolean;
}

/** Location config for CR API calls */
export interface LocationConfig {
  key: string;
  location: string;
  venue: string;
  address: string;
  orgId: number;
  widgetUrl: string;
}

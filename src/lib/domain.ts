import type {
  Appointment,
  AppointmentKind,
  DoseStatus,
  JournalKind,
  Medication,
  Shift,
} from "@/lib/db/schema";
import type { DoseState } from "@/lib/meds";

/** Decrypted shapes of the encrypted JSON columns. */

export type MedicationDetails = {
  name: string;
  dosage: string;
  instructions: string;
  purpose: string;
  prescriber: string;
};

export type MedicationView = Omit<Medication, "dataEnc"> & MedicationDetails;

export type AppointmentDetails = {
  title: string;
  location: string;
  provider: string;
  notes: string;
};

export type AppointmentView = Omit<Appointment, "dataEnc"> & AppointmentDetails;

export type ShiftView = Omit<Shift, "noteEnc"> & { note: string | null };

export type DoseLogView = {
  id: string;
  medicationId: string;
  scheduledFor: Date | null;
  status: DoseStatus;
  takenAt: Date;
  recordedBy: string | null;
  note: string | null;
};

export type DoseItem = {
  med: MedicationView;
  scheduledFor: Date;
  state: DoseState;
  log: DoseLogView | null;
};

export type Vitals = {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  temperature?: number;
  temperatureUnit?: "F" | "C";
  weight?: number;
  weightUnit?: "lb" | "kg";
  glucose?: number;
  oxygen?: number;
};

export type JournalView = {
  id: string;
  kind: JournalKind;
  authorId: string | null;
  body: string;
  mood: number | null;
  vitals: Vitals | null;
  createdAt: Date;
};

export type TaskView = {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  doneAt: Date | null;
  doneBy: string | null;
  createdBy: string | null;
  createdAt: Date;
};

export type Contact = { name: string; relation: string; phone: string };
export type Provider = { name: string; specialty: string; phone: string };

export type ProfileData = {
  preferredName: string;
  dateOfBirth: string;
  pronouns: string;
  conditions: string;
  allergies: string;
  bloodType: string;
  medicalNotes: string;
  mobility: string;
  diet: string;
  communication: string;
  routines: string;
  advanceDirective: string;
  insurance: string;
  pharmacy: string;
  providers: Provider[];
  emergencyContacts: Contact[];
};

export const EMPTY_PROFILE: ProfileData = {
  preferredName: "",
  dateOfBirth: "",
  pronouns: "",
  conditions: "",
  allergies: "",
  bloodType: "",
  medicalNotes: "",
  mobility: "",
  diet: "",
  communication: "",
  routines: "",
  advanceDirective: "",
  insurance: "",
  pharmacy: "",
  providers: [],
  emergencyContacts: [],
};

export const APPOINTMENT_KINDS: { value: AppointmentKind; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "therapy", label: "Therapy" },
  { value: "lab", label: "Lab or test" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "other", label: "Other" },
];

export const JOURNAL_KINDS: { value: JournalKind; label: string; hint: string }[] = [
  { value: "handoff", label: "Handoff", hint: "What the next person on duty should know" },
  { value: "note", label: "Note", hint: "Anything worth remembering" },
  { value: "vitals", label: "Vitals", hint: "Blood pressure, pulse, temperature…" },
  { value: "incident", label: "Incident", hint: "A fall, a reaction, a worrying change" },
];

export const MOODS = [
  { value: 5, label: "Great" },
  { value: 4, label: "Good" },
  { value: 3, label: "Okay" },
  { value: 2, label: "Low" },
  { value: 1, label: "Poor" },
] as const;

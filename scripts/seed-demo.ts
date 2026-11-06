/**
 * Creates a realistic demo care circle so you can try Kinshift in seconds.
 *
 *   DATA_DIR=./demo-data npm run db:seed-demo
 *
 * Sign in as maya@example.com (organizer) or daniel@example.com, password
 * "kinshift-demo". Run it against an empty data directory: it refuses to touch
 * a database that already has users unless you pass --force.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  activity,
  circles,
  appointments,
  doseLogs,
  journalEntries,
  medications,
  memberships,
  profiles,
  shifts,
  tasks,
  users,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createCircle } from "@/lib/circles";
import { type CircleCipher } from "@/lib/crypto";
import type { ProfileData } from "@/lib/domain";
import { newId } from "@/lib/id";
import { cipherFor } from "@/lib/keys";
import { doseInstantsBetween } from "@/lib/meds";
import { DAY, HOUR, MINUTE, addDays, startOfWeek, todayIn, zonedInstant } from "@/lib/time";

const PASSWORD = "kinshift-demo";
const tz = process.env.KINSHIFT_DEMO_TZ ?? "America/Chicago";
const db = getDb();

if (db.select().from(users).all().length > 0 && !process.argv.includes("--force")) {
  console.error("This database already has users. Use an empty DATA_DIR, or pass --force.");
  process.exit(1);
}

const now = new Date();
const today = todayIn(tz, now);
const at = (dayOffset: number, time: string) => zonedInstant(addDays(today, dayOffset), time, tz);

async function user(name: string, email: string, hour12 = true) {
  const id = newId();
  db.insert(users)
    .values({
      id,
      name,
      email,
      passwordHash: await hashPassword(PASSWORD),
      hour12,
      createdAt: new Date(now.getTime() - 40 * DAY),
    })
    .run();
  return id;
}

async function main() {
  const maya = await user("Maya Chen", "maya@example.com");
  const daniel = await user("Daniel Chen", "daniel@example.com");
  const priya = await user("Priya Shah", "priya@example.com");
  const grace = await user("Grace Chen", "grace@example.com");

  const circleId = createCircle({
    userId: maya,
    recipientName: "Mom",
    name: "Caring for Mom",
    timezone: tz,
    relationship: "Daughter",
    coverageStart: "08:00",
    coverageEnd: "20:00",
  });
  const circle = db.select().from(circles).where(eq(circles.id, circleId)).get()!;
  // Backdate the circle so the demo looks like it has been used for a while.
  const started = new Date(now.getTime() - 40 * DAY);
  db.update(circles).set({ createdAt: started }).where(eq(circles.id, circleId)).run();
  db.update(activity).set({ createdAt: started }).where(eq(activity.circleId, circleId)).run();
  db.update(memberships)
    .set({ createdAt: started })
    .where(eq(memberships.circleId, circleId))
    .run();
  const cipher: CircleCipher = cipherFor(circle);
  const members = [
    { userId: daniel, role: "caregiver" as const, relationship: "Son", color: "violet" },
    { userId: priya, role: "caregiver" as const, relationship: "Home aide", color: "amber" },
    { userId: grace, role: "viewer" as const, relationship: "Granddaughter", color: "sky" },
  ];
  for (const m of members) {
    db.insert(memberships)
      .values({ id: newId(), circleId, ...m, createdAt: new Date(now.getTime() - 30 * DAY) })
      .run();
  }

  // Medications
  type MedSeed = {
    name: string;
    dosage: string;
    instructions: string;
    purpose: string;
    prescriber: string;
    scheduleType: "scheduled" | "prn";
    times: string[];
    color: string;
    stockCount?: number;
    minIntervalMinutes?: number;
    maxPerDay?: number;
  };
  const medSeeds: MedSeed[] = [
    {
      name: "Metformin",
      dosage: "500 mg",
      instructions: "Take with breakfast and dinner.",
      purpose: "Blood sugar",
      prescriber: "Dr. Patel",
      scheduleType: "scheduled",
      times: ["08:00", "18:00"],
      color: "teal",
      stockCount: 46,
    },
    {
      name: "Lisinopril",
      dosage: "10 mg",
      instructions: "Check blood pressure first if she feels dizzy.",
      purpose: "Blood pressure",
      prescriber: "Dr. Okafor",
      scheduleType: "scheduled",
      times: ["08:00"],
      color: "rose",
      stockCount: 5,
    },
    {
      name: "Vitamin D3",
      dosage: "1000 IU",
      instructions: "With lunch.",
      purpose: "Bone health",
      prescriber: "",
      scheduleType: "scheduled",
      times: ["12:30"],
      color: "amber",
    },
    {
      name: "Donepezil",
      dosage: "5 mg",
      instructions: "At bedtime. Can cause vivid dreams.",
      purpose: "Memory",
      prescriber: "Dr. Patel",
      scheduleType: "scheduled",
      times: ["21:00"],
      color: "violet",
      stockCount: 28,
    },
    {
      name: "Acetaminophen",
      dosage: "500 mg",
      instructions: "For knee pain. No more than 4 doses a day.",
      purpose: "Pain",
      prescriber: "",
      scheduleType: "prn",
      times: [],
      color: "sky",
      minIntervalMinutes: 360,
      maxPerDay: 4,
    },
  ];
  const meds = medSeeds.map((m) => {
    const id = newId();
    db.insert(medications)
      .values({
        id,
        circleId,
        dataEnc: cipher.encJson("medication.data", {
          name: m.name,
          dosage: m.dosage,
          instructions: m.instructions,
          purpose: m.purpose,
          prescriber: m.prescriber,
        }),
        scheduleType: m.scheduleType,
        times: m.times,
        startDate: addDays(today, -60),
        stockCount: m.stockCount ?? null,
        minIntervalMinutes: m.minIntervalMinutes ?? null,
        maxPerDay: m.maxPerDay ?? null,
        color: m.color,
        createdBy: maya,
        createdAt: new Date(now.getTime() - 60 * DAY),
      })
      .run();
    return {
      ...m,
      id,
      daysOfWeek: null,
      startDate: addDays(today, -60),
      endDate: null,
      active: true,
    };
  });

  // Dose history for the last 10 days. Doses due in the last hour are left open
  // so the checklist shows what is due right now.
  const givers = [maya, daniel, priya];
  let n = 0;
  for (const med of meds.filter((m) => m.scheduleType === "scheduled")) {
    for (const t of doseInstantsBetween(
      med,
      new Date(now.getTime() - 10 * DAY),
      new Date(now.getTime() - 50 * MINUTE),
      tz,
    )) {
      n++;
      if (n % 23 === 0) continue; // the occasional missed dose
      const skipped = n % 31 === 0;
      db.insert(doseLogs)
        .values({
          id: newId(),
          circleId,
          medicationId: med.id,
          scheduledFor: t,
          status: skipped ? "skipped" : "given",
          takenAt: new Date(t.getTime() + ((n * 7) % 25) * MINUTE),
          recordedBy: givers[n % 3],
          noteEnc: skipped
            ? cipher.enc("dose.note", "She was asleep; doctor said to skip it.")
            : null,
          createdAt: new Date(t.getTime() + ((n * 7) % 25) * MINUTE),
        })
        .run();
    }
  }
  const prn = meds.find((m) => m.scheduleType === "prn")!;
  db.insert(doseLogs)
    .values({
      id: newId(),
      circleId,
      medicationId: prn.id,
      scheduledFor: null,
      status: "given",
      takenAt: new Date(now.getTime() - 2.5 * HOUR),
      recordedBy: daniel,
      createdAt: new Date(now.getTime() - 2.5 * HOUR),
    })
    .run();

  // Shifts: this week and next, with a weekend gap and an open shift.
  const weekStart = startOfWeek(today);
  const offset = (d: string) =>
    Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  for (let i = -7; i < 14; i++) {
    const d = addDays(weekStart, i);
    const o = offset(d);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    const add = (start: string, end: string, who: string | null, note?: string) =>
      db
        .insert(shifts)
        .values({
          id: newId(),
          circleId,
          startsAt: at(o, start),
          endsAt: at(o, end),
          assigneeId: who,
          noteEnc: note ? cipher.enc("shift.note", note) : null,
          createdBy: maya,
          createdAt: new Date(now.getTime() - 20 * DAY),
        })
        .run();
    if (wd >= 1 && wd <= 5) {
      add("08:00", "13:00", wd === 2 || wd === 4 ? priya : maya);
      add("13:00", "20:00", daniel);
    } else if (wd === 6) {
      add("08:00", "14:00", maya);
      if (i >= 7) add("14:00", "20:00", null, "Daniel is away this weekend");
    } else {
      add("10:00", "20:00", daniel);
    }
  }

  // Appointments, including one clash.
  const appt = (
    dayOffset: number,
    start: string,
    end: string,
    kind: "doctor" | "therapy" | "lab" | "dental",
    d: { title: string; location: string; provider: string; notes: string },
    who: string | null,
  ) =>
    db
      .insert(appointments)
      .values({
        id: newId(),
        circleId,
        dataEnc: cipher.encJson("appointment.data", d),
        kind,
        startsAt: at(dayOffset, start),
        endsAt: at(dayOffset, end),
        assigneeId: who,
        createdBy: maya,
        createdAt: new Date(now.getTime() - 5 * DAY),
      })
      .run();
  appt(
    1,
    "10:30",
    "11:30",
    "doctor",
    {
      title: "Cardiology follow-up",
      location: "St. Mary’s Heart Center, 2nd floor",
      provider: "Dr. Okafor",
      notes: "Bring the blood pressure log.\nAsk about the ankle swelling.",
    },
    maya,
  );
  appt(
    3,
    "14:00",
    "15:00",
    "therapy",
    {
      title: "Physical therapy",
      location: "Riverside Rehab",
      provider: "Jordan (PT)",
      notes: "Wear sneakers.",
    },
    null,
  );
  appt(
    5,
    "09:00",
    "09:45",
    "lab",
    {
      title: "Blood work (A1C)",
      location: "Quest Diagnostics",
      provider: "",
      notes: "Fasting from midnight.",
    },
    daniel,
  );
  appt(
    5,
    "09:30",
    "10:30",
    "dental",
    { title: "Dental cleaning", location: "Bright Smile Dental", provider: "Dr. Kim", notes: "" },
    null,
  );
  appt(
    -6,
    "11:00",
    "12:00",
    "doctor",
    {
      title: "Primary care check-up",
      location: "Oak Street Clinic",
      provider: "Dr. Patel",
      notes: "A1C improving. Keep current doses.",
    },
    maya,
  );

  // Journal
  const entry = (
    hoursAgo: number,
    author: string,
    kind: "note" | "handoff" | "vitals" | "incident",
    body: string,
    mood: number | null,
    vitals?: object,
  ) =>
    db
      .insert(journalEntries)
      .values({
        id: newId(),
        circleId,
        authorId: author,
        kind,
        bodyEnc: cipher.enc("journal.body", body),
        mood,
        vitalsEnc: vitals ? cipher.encJson("journal.vitals", vitals) : null,
        createdAt: new Date(now.getTime() - hoursAgo * HOUR),
      })
      .run();
  entry(
    70,
    priya,
    "incident",
    "Mom stumbled in the hallway on the way to the bathroom around 2pm. No injury, she sat down for a few minutes and was fine. Moved the rug that was bunching up.",
    3,
  );
  entry(50, daniel, "vitals", "Taken after dinner.", null, {
    bpSystolic: 134,
    bpDiastolic: 84,
    pulse: 72,
    weight: 141.5,
    weightUnit: "lb",
  });
  entry(
    28,
    maya,
    "note",
    "Dr. Patel’s office called: the A1C order is in, any Quest location works. Needs to be fasting.",
    4,
  );
  entry(
    20,
    daniel,
    "handoff",
    "Good evening. She ate most of her dinner and watched the baking show. Bedtime meds given at 9. She asked about Grace’s visit on Sunday, so maybe remind her in the morning.",
    4,
  );
  entry(
    5,
    maya,
    "handoff",
    "Morning went well. Slept through the night, breakfast and 8 AM meds done. Knee is a bit sore so we skipped the walk. Lisinopril is running low, the refill is ready at Walgreens.",
    4,
  );
  entry(3, maya, "vitals", "", null, {
    bpSystolic: 128,
    bpDiastolic: 80,
    pulse: 70,
    oxygen: 97,
    temperature: 98.2,
    temperatureUnit: "F",
  });

  // Tasks
  const task = (title: string, dueOffset: number | null, who: string | null, done = false) =>
    db
      .insert(tasks)
      .values({
        id: newId(),
        circleId,
        titleEnc: cipher.enc("task.title", title),
        dueDate: dueOffset === null ? null : addDays(today, dueOffset),
        assigneeId: who,
        doneAt: done ? new Date(now.getTime() - 26 * HOUR) : null,
        doneBy: done ? priya : null,
        createdBy: maya,
        createdAt: new Date(now.getTime() - 3 * DAY),
      })
      .run();
  task("Pick up Lisinopril refill at Walgreens", 0, daniel);
  task("Call Medicare about the supplement plan", 2, maya);
  task("Order a new shower chair", null, null);
  task("Buy compression socks", -1, priya, true);

  // Profile
  const profile: ProfileData = {
    preferredName: "Eleanor “Ellie” Chen",
    dateOfBirth: "1944-03-18",
    pronouns: "she/her",
    conditions:
      "Type 2 diabetes, high blood pressure, early-stage Alzheimer’s, osteoarthritis (right knee)",
    allergies: "Penicillin (hives), shellfish",
    bloodType: "A+",
    medicalNotes: "Hearing aid in left ear. Reading glasses on the nightstand.",
    mobility:
      "Walker indoors, wheelchair for long outings. Higher fall risk at night: keep the hallway light on.",
    diet: "Low sugar, soft foods. Loves jasmine tea and congee.",
    communication: "Speak slowly, facing her. Mornings are her best time for conversations.",
    routines:
      "Up around 7. Crossword with breakfast, nap after lunch, baking shows in the evening.",
    advanceDirective:
      "Living will and POA documents in the blue folder, hall closet. Maya is health care proxy.",
    insurance: "Medicare + AARP supplement plan G",
    pharmacy: "Walgreens on Main St, (555) 010-2299",
    providers: [
      { name: "Dr. Anita Patel", specialty: "Primary care", phone: "(555) 010-4410" },
      { name: "Dr. James Okafor", specialty: "Cardiology", phone: "(555) 010-8823" },
    ],
    emergencyContacts: [
      { name: "Maya Chen", relation: "Daughter", phone: "(555) 010-1201" },
      { name: "Daniel Chen", relation: "Son", phone: "(555) 010-1202" },
    ],
  };
  db.insert(profiles)
    .values({
      circleId,
      dataEnc: cipher.encJson("profile.data", profile),
      updatedAt: new Date(now.getTime() - 2 * DAY),
      updatedBy: maya,
    })
    .run();

  // A few activity entries for the feed.
  const act = (minutesAgo: number, actor: string, type: string, data: object = {}) =>
    db
      .insert(activity)
      .values({
        id: newId(),
        circleId,
        actorId: actor,
        type,
        dataEnc: cipher.encJson("activity.data", data),
        createdAt: new Date(now.getTime() - minutesAgo * MINUTE),
      })
      .run();
  act(300, maya, "journal.added", { kind: "handoff" });
  act(240, maya, "dose.given", { med: "Lisinopril", scheduledFor: at(0, "08:00").toISOString() });
  act(180, maya, "journal.added", { kind: "vitals" });
  act(150, daniel, "dose.given", { med: "Acetaminophen" });
  act(95, priya, "shift.claimed", { start: at(2, "08:00").toISOString() });
  act(40, maya, "task.added", { title: "Pick up Lisinopril refill at Walgreens" });

  console.log(`Demo circle created in ${tz}. Sign in as maya@example.com / ${PASSWORD}`);
  console.log(`Circle: /c/${circleId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

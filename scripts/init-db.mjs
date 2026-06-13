import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = resolve("prisma/dev.db");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "heightCm" REAL,
  "weightKg" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

CREATE TABLE IF NOT EXISTS "Workout" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "weekday" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WorkoutExercise" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workoutId" TEXT NOT NULL,
  "exerciseId" INTEGER NOT NULL,
  "order" INTEGER NOT NULL,
  "sets" INTEGER,
  "reps" TEXT,
  "restSeconds" INTEGER,
  "loadKg" REAL,
  "notes" TEXT,
  CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WorkoutLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "workoutId" TEXT,
  "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMin" INTEGER,
  "notes" TEXT,
  CONSTRAINT "WorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkoutLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LogSet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "logId" TEXT NOT NULL,
  "exerciseId" INTEGER NOT NULL,
  "setNumber" INTEGER NOT NULL,
  "reps" INTEGER,
  "loadKg" REAL,
  "done" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "LogSet_logId_fkey" FOREIGN KEY ("logId") REFERENCES "WorkoutLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "BodyMetric" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "weightKg" REAL,
  "heightCm" REAL,
  "bodyFat" REAL,
  "measuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`);

db.close();

console.log(`SQLite database ready at ${dbPath}`);

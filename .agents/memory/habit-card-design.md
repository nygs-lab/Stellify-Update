---
name: Habit Card design system
description: Warm tan/brown palette and shared DailyHabitCard component used for SHC001 Prayer and SHC002 Devotion in spiritual.tsx.
---

The HC color token object (Record<string, string>) and the DailyHabitCard component live in `artifacts/stellify/src/pages/disciple/spiritual.tsx` above the PrayerCard/DevotionCard wrappers.

**Design:** 4-level tracking grid (L1 completion · L2 compliance · L3A time committed · L3B duration log), 7-day columns + summary column. Devotion adds a "Detail Logging" section below (type dropdown + details text per day, split Sun–Wed / Thu–Sat).

**Why:** Matches the PRD Stellify Habit Card mockup (warm tan/brown palette, level rows, summary column). Canvas prototype (`shc-habit-card`) was the reference.

**How to apply:** When adding more SHC cards with the same row structure, extend DailyHabitConfig and pass a new config to DailyHabitCard. The `hasDetailLog` flag controls the Devotion-specific section.

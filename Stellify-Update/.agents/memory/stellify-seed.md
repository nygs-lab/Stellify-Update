---
name: Stellify seed accounts
description: Pre-seeded member accounts for development and testing — role/stellar/CG references only, no credentials.
---

# Stellify Seed Accounts

Seeded directly via SQL (no seed script file — run manually if DB is reset).

| Church ID | Role           | Stellar | CG   | Huddle |
|-----------|----------------|---------|------|--------|
| PCM0001   | Admin          | P2G     | —    | —      |
| PCM0002   | Servant        | S2B     | CG01 | SH01   |
| PCM0003   | Member         | P2S     | CG01 | SH01   |
| PCM0004   | Member         | SBG     | CG02 | SH02   |
| PCM0005   | SharingCaptain | P2G     | CG02 | SH02   |

PCM0001 has `discipleship_enabled = false` (admin account, no countdown/habits).
All others have `sbg_end_date = 2029-12-31` per PRD legacy member rule.

Passwords are NOT stored in memory. Check `replit.md` Seed accounts table for development passwords used in demo/testing.

## Why
PRD requires 52 legacy members seeded with SBG end date Dec 31, 2029. These 5 cover the core roles for development testing.

## How to apply
To re-seed after a DB reset, generate bcrypt hashes then run INSERT statements from the seeding session.
Passwords are in the project README (`replit.md`) Seed accounts section — do not duplicate here.

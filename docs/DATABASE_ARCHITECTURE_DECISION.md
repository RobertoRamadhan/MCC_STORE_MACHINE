# DATABASE ARCHITECTURE DECISION NEEDED

## Current Situation
- 32 files hardcoded with 3 different server/IP values
- `192.168.100.1` is a "ghost IP" with no git history
- No formal multi-environment strategy exists in the repo
- There are conflicting SQL credentials across the project
- This creates ambiguity between local dev, admin laptop, and panel PC/server deployment

## Findings
- Several routes use `localhost` directly
- Several routes use `192.168.100.1`
- Some configs point to `169.254.57.26` in runtime notes/logs
- Environment files are not fully consistent across backend/frontend
- Password values differ between config files and runtime notes

## Required Decision
User must confirm all of the following before any database migration is executed:

1. Which server is the source of truth?
   - [ ] Admin Laptop SQL Server
   - [ ] Panel PC / machine server
   - [ ] Other: ____________________

2. Is the Admin Laptop database used or not?
   - [ ] Yes, Admin Laptop is the real DB server
   - [ ] No, Admin Laptop is only a local dev machine
   - [ ] Not sure / need verification

3. What is the correct IP / hostname?
   - [ ] `localhost\SQLEXPRESS`
   - [ ] `169.254.57.26\SQLEXPRESS`
   - [ ] `192.168.100.1`
   - [ ] Other: ____________________

4. What is the correct password?
   - [ ] `Philips2026!`
   - [ ] `Mcc@2026!`
   - [ ] Other: ____________________

5. Which environment is the real production target?
   - [ ] Local development
   - [ ] Admin laptop
   - [ ] Panel PC
   - [ ] Mixed / multiple systems

## Decision Form
Please fill this before proceeding:

- Source of truth server: ____________________
- Server hostname/IP: ____________________
- SQL instance: ____________________
- Database name: ____________________
- Username: ____________________
- Password: ____________________
- Environment type: ____________________
- Connection verified via SSMS / SQL client: [ ] Yes [ ] No
- Date verified: ____________________

## Why this matters
Without a single official DB source, every route can silently point to the wrong machine. This creates:
- failed RFID scans
- broken part requests
- inconsistent data between admin and teknisi apps
- production instability

## Once decided, execute the migration

### STEP 1: Standardize the database target
- Pick one canonical server/IP and one canonical SQL instance
- Remove all hardcoded hostnames from runtime code
- Keep only environment-based values in `.env.local` or equivalent

### STEP 2: Standardize credentials
- Use a single verified DB username and password
- Document the exact credential pair used in production
- Remove conflicting password values from different files

### STEP 3: Centralize config
- Set `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Replace all legacy `server: 'localhost'` and `server: '192.168.100.1'` values

### STEP 4: Validate all routes
- Run a targeted database connectivity test for every route group
- Confirm all pages can read/write to the chosen server
- Validate RFID, part requests, and technician flows

### STEP 5: Production readiness check
- Confirm all 32 affected files are fixed
- Confirm no hardcoded DB host remains in runtime files
- Confirm the system works from the chosen server target

## Completion Criteria
The migration is complete only when all of the following are true:
- 100% of database host references are environment-driven
- 100% of conflicting credentials are resolved
- The actual target server has been verified via SQL client
- The system is ready for production use

## Final Note
Until confirmed, this repository should be treated as having an ambiguous database architecture. No production-safe changes should be made without an explicit decision from the user.

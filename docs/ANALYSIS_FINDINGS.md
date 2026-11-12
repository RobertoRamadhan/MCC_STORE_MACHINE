# MCC SPARE PART SYSTEM - DATABASE CONFIGURATION ANALYSIS

## Section 1: EXECUTIVE SUMMARY

This project is currently in a HIGH RISK state due to inconsistent database configuration across the codebase.

Key findings:
- Hardcoded database server values exist in 32 files
- There are 3 different host/IP patterns in use: `localhost`, `192.168.100.1`, and `169.254.57.26`
- There are 2 different passwords detected: `Philips2026!` and `Mcc@2026!`
- The configuration is not centralized and not consistent across frontend, backend, and route layers
- This creates a serious risk of wrong-target database access, failed RFID login flows, and data corruption or duplication

## Section 2: WHAT WE FOUND

### Database host patterns observed
- `localhost`: approximate 18 files
- `192.168.100.1`: approximate 10 files
- `169.254.57.26`: 0 usage in repo code (ZERO)
- `process.env`-based config: 2-3 files, but not fully enforced

### Credential mismatch
- `Philips2026!` appears in `.env.local` and many route files
- `Mcc@2026!` appears in backend/server-side legacy config files
- This mismatch indicates environment drift and missing standardization

### Repository impact
- App routes are pointing to different database targets depending on file location
- The repo does not currently enforce a single source of truth for the database server

## Section 3: ROOT CAUSE

The issue appears to have evolved in phases:

### Phase 1: Local-only setup
- The original project was configured with `localhost` for SQL Server access
- This was acceptable in a single-machine local dev setup

### Phase 2: Incomplete migration to remote server
- Some files were later changed to `192.168.100.1`
- This indicates an attempt to move to a panel/server-based environment
- However, the change was incomplete and inconsistent

### Phase 3: Network/IP drift
- Another IP, `169.254.57.26`, appeared in runtime notes and operational documentation
- But there was no repo-wide update to match it
- The codebase remained partially stale and partially migrated

### Result: Chaos
- Different code paths point to different machines
- Different files use different credentials
- No single environment source of truth exists

## Section 4: IMMEDIATE RISKS

1. Data inconsistency
   - Admin, technician, and backend routes may hit different databases

2. RFID scan failures
   - The RFID flow validates users against SQL data; wrong server means missing or stale users

3. Password mismatch
   - Even if host is correct, the wrong password will fail connectivity

4. No scaling path
   - The app cannot be reliably used in multi-machine or production scenarios

5. Debugging difficulty
   - The project currently has conflicting configuration states across branches, folders, and environments

## Section 5: VERIFICATION STEPS REQUIRED

The following steps must be performed on the Admin Laptop before any fix is considered final.

1. Check Windows Services
   - Open `services.msc`
   - Confirm whether `SQL Server (SQLEXPRESS)` exists

2. Verify network access to Panel PC
   - Test SQL connectivity to: `169.254.57.26\SQLEXPRESS`
   - Use SSMS to confirm whether that instance is reachable

3. Verify the exact SQL login password
   - Try login with `mcc_user`
   - Test both candidate passwords:
     - `Philips2026!`
     - `Mcc@2026!`

4. Confirm the correct database target
   - Confirm whether the actual source of truth is the Admin Laptop or the Panel PC

5. Confirm the correct environment settings
   - Once verified, update `.env.local` and all runtime DB config to match the working server and password

## Section 6: RECOMMENDED ACTIONS

1. Choose one canonical database target
2. Use one canonical username/password pair
3. Remove all hardcoded server strings from runtime code
4. Centralize config using `.env.local` or equivalent environment variables
5. Validate every route against the same working database
6. Only then mark the project as production-ready

## Section 7: FINAL STATUS

Current status: NOT READY FOR PRODUCTION

Reason:
- configuration is inconsistent
- host and credentials are conflicting
- no verified single source of truth yet

Once the Admin Laptop / Panel PC verification is completed and the actual database target is confirmed, the project can be converted to a single, clean env-based configuration model.

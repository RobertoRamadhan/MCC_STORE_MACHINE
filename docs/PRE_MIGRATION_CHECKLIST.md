# PRE MIGRATION CHECKLIST

## Phase 1: VERIFICATION (User - Admin Laptop)

- [ ] Check `services.msc` and confirm whether `SQL Server (SQLEXPRESS)` exists
- [ ] Test SSMS connection to `169.254.57.26\SQLEXPRESS`
- [ ] Record which password works:
  - [ ] `Philips2026!`
  - [ ] `Mcc@2026!`
  - [ ] Other: ____________________
- [ ] Confirm whether database `MCC_SparePartDB` exists
- [ ] Confirm whether the Admin Laptop is the actual DB source or not
- [ ] Record the final verified server/instance details

## Phase 2: ARCHITECTURE DECISION (User)

- [ ] Read `DATABASE_ARCHITECTURE_DECISION.md`
- [ ] Choose one of the following:
  - [ ] Option A: Use Admin Laptop SQL Server
  - [ ] Option B: Use Panel PC / remote SQL Server
  - [ ] Option C: Use another server / hostname
- [ ] Write the reason for the decision:
  - ____________________________________________
- [ ] Confirm the final IP/hostname to use
- [ ] Confirm the final DB password to use

## Phase 3: PREPARATION (Developer)

- [ ] Backup current codebase (`git status` / branch snapshot)
- [ ] Create a separate working branch for the database migration
- [ ] Prepare `lib/db-config.ts` (planned central config file, not yet deployed)
- [ ] List all 32 affected files before making changes
- [ ] Prepare migration script for server replacement and env-standardization
- [ ] Confirm no live production deployment is running during migration
- [ ] Prepare rollback steps if the migration fails

## Phase 4: EXECUTION (After all above is complete)

- [ ] Run migration script
- [ ] Verify all files updated
- [ ] Ensure no hardcoded DB host remains in runtime files
- [ ] Update env configuration to the verified server/password
- [ ] Test all backend endpoints
- [ ] Test RFID functionality
- [ ] Test part-in / part-out flows
- [ ] Test dashboard load and page rendering
- [ ] Confirm the app can connect to the final DB target

## SIGN-OFF SECTION

- [ ] User confirms final architecture decision
- [ ] User confirms verification results from Admin Laptop
- [ ] Developer confirms preparation is complete
- [ ] Ready for Phase 4 migration execution

## FINAL NOTE

This checklist must be completed before any production-safe database migration is executed. Until the verified database target and password are confirmed, the project remains in an ambiguous state.

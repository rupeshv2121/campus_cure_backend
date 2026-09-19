/**
 * Tags identifying seeded demo records.
 *
 * In their own module deliberately. They previously lived in seedDemoData.ts,
 * and removeDemoData imported them from there — which executed the seeder's
 * top-level main() on import. Running the remover without --dry-run would have
 * SEEDED the database before removing anything.
 *
 * Constants shared between a script and its inverse must not live inside
 * either one.
 */
export const SEED_PREFIX = "SEED_";
export const SEED_EMAIL_DOMAIN = "@seed.campuscure.local";

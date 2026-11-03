/**
 * The password every customer account starts with.
 *
 * Deliberately a fixed, memorable value rather than a generated one: staff read
 * it out at the counter, often over a phone, and a random 24-character string
 * does not survive that. It is the same for every customer, so it is not a
 * secret and is never treated as one.
 *
 * What makes that safe is `must_change_password`. An account still carrying the
 * starter can do exactly one thing in the app -- choose a new password -- so
 * knowing this value buys an attacker nothing beyond a change-password screen.
 * Anything that clears the flag without also taking a new password from the
 * customer reopens the hole this constant would otherwise be.
 */
export const CUSTOMER_STARTER_PASSWORD = "123456";

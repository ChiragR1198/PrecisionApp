/**
 * Single source of truth for Expo EAS — must stay aligned with app.json:
 *   expo.owner
 *   expo.slug
 *   expo.extra.eas.projectId
 *
 * Live / TestFlight builds must be produced logged in as this Expo account so
 * push tokens and APNs credentials match (no @other-account project mix-ups).
 */
export const EXPO_ACCOUNT_OWNER = 'raviridge2021';
export const EXPO_SLUG = 'PrecisionGlobalSummits';
export const EAS_PROJECT_ID = '7383a335-b805-4b75-acb9-c67ce0ef4376';

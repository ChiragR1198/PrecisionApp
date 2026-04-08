/**
 * Partner logo filenames under `assets/front/images/logos/partners/` — mirrors
 * `application/views/front/single-event.php` “Confirmed For Our Upcoming Conferences”.
 */

/** Default grid (1–6, 9–26; skips 7–8 like the web). */
export const FUTURE_SUMMITS_BASE_FILENAMES = [
  '1.png',
  '2.png',
  '3.png',
  '4.png',
  '5.png',
  '6.png',
  '9.png',
  '10.png',
  '11.png',
  '12.png',
  '13.png',
  '14.png',
  '15.png',
  '16.png',
  '17.png',
  '18.png',
  '19.png',
  '20.png',
  '21.png',
  '22.png',
  '23.png',
  '24.png',
  '25.png',
  '26.png',
];

/** Extra logos when `category_id` is 7 or 4 (same condition as single-event.php). */
export const FUTURE_SUMMITS_UC_FILENAMES = [
  'uc_logo_1.png',
  'uc_logo_2.png',
  'uc_logo_3.jpg',
  'uc_logo_4.jpg',
  'uc_logo_5.png',
  'uc_logo_6.png',
  'uc_logo_7.png',
  'uc_logo_8.jpg',
  'uc_logo_9.png',
  'uc_logo_11.png',
  'uc_logo_12.png',
  'uc_logo_13.jpg',
  'uc_logo_14.jpg',
  'uc_logo_15.jpg',
  'uc_logo_16.png',
  'uc_logo_19.jpg',
  'uc_logo_22.png',
  'uc_logo_28.jpg',
  'uc_logo_32.jpeg',
  'uc_logo_37.png',
  'uc_logo_38.png',
  'uc_logo_40.png',
  'uc_logo_53.jpg',
  'uc_logo_55.png',
];

/**
 * @param {number|string|null|undefined} categoryId
 * @returns {string[]}
 */
export function getFutureSummitsPartnerFilenames(categoryId) {
  const n = Number(categoryId);
  const includeUc = n === 7 || n === 4;
  return includeUc
    ? [...FUTURE_SUMMITS_BASE_FILENAMES, ...FUTURE_SUMMITS_UC_FILENAMES]
    : [...FUTURE_SUMMITS_BASE_FILENAMES];
}

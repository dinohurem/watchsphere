/**
 * Centralized mapping between config field keys and Order model keys.
 *
 * Config keys (from listing-fields API) differ from Order model keys
 * (used in watch_details) in exactly 3 places:
 *
 * | Config Key        | Order Model Key |
 * |-------------------|-----------------|
 * | caliber_movement  | caliber         |
 * | dial_color        | dial            |
 * | dial_numbers      | dial_numerals   |
 */

/** Config key → Order model key (for submitting watch_details / reading from order) */
export const CONFIG_KEY_TO_ORDER_KEY: Record<string, string> = {
  caliber_movement: 'caliber',
  dial_color: 'dial',
  dial_numbers: 'dial_numerals',
}

/** Order model key → Config key (for loading order data into form state) */
export const ORDER_KEY_TO_CONFIG_KEY: Record<string, string> = {
  caliber: 'caliber_movement',
  dial: 'dial_color',
  dial_numerals: 'dial_numbers',
}

/** Fields handled manually in display/form (not iterated from config) */
export const MANUALLY_HANDLED_FIELDS = new Set([
  'brand',
  'model',
  'reference',
  'condition',
  'condition_description',
  'box_papers',
  'location',
  'price',
  'currency',
])

/** Resolve a config field key to its Order model key */
export function configKeyToOrderKey(key: string): string {
  return CONFIG_KEY_TO_ORDER_KEY[key] || key
}

/** Resolve an Order model key to its config field key */
export function orderKeyToConfigKey(key: string): string {
  return ORDER_KEY_TO_CONFIG_KEY[key] || key
}

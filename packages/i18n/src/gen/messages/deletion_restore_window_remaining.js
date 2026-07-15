/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ days: NonNullable<unknown> }} Deletion_Restore_Window_RemainingInputs */

const en_deletion_restore_window_remaining = /** @type {(inputs: Deletion_Restore_Window_RemainingInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`You can undo this within ${i?.days} days.`)
};

const ko_deletion_restore_window_remaining = /** @type {(inputs: Deletion_Restore_Window_RemainingInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.days}일 안에 되돌릴 수 있어요.`)
};

/**
* | output |
* | --- |
* | "You can undo this within {days} days." |
*
* @param {Deletion_Restore_Window_RemainingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restore_window_remaining = /** @type {((inputs: Deletion_Restore_Window_RemainingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Restore_Window_RemainingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restore_window_remaining(inputs)
	return ko_deletion_restore_window_remaining(inputs)
});
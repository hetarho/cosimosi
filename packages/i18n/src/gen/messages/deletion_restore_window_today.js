/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Restore_Window_TodayInputs */

const en_deletion_restore_window_today = /** @type {(inputs: Deletion_Restore_Window_TodayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Today is the last day you can undo this.`)
};

const ko_deletion_restore_window_today = /** @type {(inputs: Deletion_Restore_Window_TodayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘이 되돌릴 수 있는 마지막 날이에요.`)
};

/**
* | output |
* | --- |
* | "Today is the last day you can undo this." |
*
* @param {Deletion_Restore_Window_TodayInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restore_window_today = /** @type {((inputs?: Deletion_Restore_Window_TodayInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Restore_Window_TodayInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restore_window_today(inputs)
	return ko_deletion_restore_window_today(inputs)
});
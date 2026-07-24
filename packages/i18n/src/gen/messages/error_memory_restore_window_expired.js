/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Restore_Window_ExpiredInputs */

const en_error_memory_restore_window_expired = /** @type {(inputs: Error_Memory_Restore_Window_ExpiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The time to restore that diary has passed.`)
};

const ko_error_memory_restore_window_expired = /** @type {(inputs: Error_Memory_Restore_Window_ExpiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기를 되돌릴 수 있는 기간이 지났어요.`)
};

/**
* | output |
* | --- |
* | "The time to restore that diary has passed." |
*
* @param {Error_Memory_Restore_Window_ExpiredInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_restore_window_expired = /** @type {((inputs?: Error_Memory_Restore_Window_ExpiredInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Restore_Window_ExpiredInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_restore_window_expired(inputs)
	return ko_error_memory_restore_window_expired(inputs)
});
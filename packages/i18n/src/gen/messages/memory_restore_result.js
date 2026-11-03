/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Memory_Restore_ResultInputs */

const en_memory_restore_result = /** @type {(inputs: Memory_Restore_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The stored memory is clear again.`)
};

const ko_memory_restore_result = /** @type {(inputs: Memory_Restore_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`저장된 기억을 그대로 되살렸어요.`)
};

/**
* | output |
* | --- |
* | "The stored memory is clear again." |
*
* @param {Memory_Restore_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const memory_restore_result = /** @type {((inputs?: Memory_Restore_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Memory_Restore_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_memory_restore_result(inputs)
	return ko_memory_restore_result(inputs)
});
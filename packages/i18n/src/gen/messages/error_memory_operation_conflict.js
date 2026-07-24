/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Operation_ConflictInputs */

const en_error_memory_operation_conflict = /** @type {(inputs: Error_Memory_Operation_ConflictInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That action is already being processed. Try again in a moment.`)
};

const ko_error_memory_operation_conflict = /** @type {(inputs: Error_Memory_Operation_ConflictInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이미 처리 중인 작업이에요. 잠시 뒤 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "That action is already being processed. Try again in a moment." |
*
* @param {Error_Memory_Operation_ConflictInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_operation_conflict = /** @type {((inputs?: Error_Memory_Operation_ConflictInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Operation_ConflictInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_operation_conflict(inputs)
	return ko_error_memory_operation_conflict(inputs)
});
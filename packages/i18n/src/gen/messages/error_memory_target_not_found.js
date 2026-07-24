/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Target_Not_FoundInputs */

const en_error_memory_target_not_found = /** @type {(inputs: Error_Memory_Target_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That memory could not be found.`)
};

const ko_error_memory_target_not_found = /** @type {(inputs: Error_Memory_Target_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`해당 기억을 찾지 못했어요.`)
};

/**
* | output |
* | --- |
* | "That memory could not be found." |
*
* @param {Error_Memory_Target_Not_FoundInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_target_not_found = /** @type {((inputs?: Error_Memory_Target_Not_FoundInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Target_Not_FoundInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_target_not_found(inputs)
	return ko_error_memory_target_not_found(inputs)
});
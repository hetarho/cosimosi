/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Target_UnavailableInputs */

const en_error_memory_target_unavailable = /** @type {(inputs: Error_Memory_Target_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That memory is not available for this action.`)
};

const ko_error_memory_target_unavailable = /** @type {(inputs: Error_Memory_Target_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 해당 기억에 이 작업을 할 수 없어요.`)
};

/**
* | output |
* | --- |
* | "That memory is not available for this action." |
*
* @param {Error_Memory_Target_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_target_unavailable = /** @type {((inputs?: Error_Memory_Target_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Target_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_target_unavailable(inputs)
	return ko_error_memory_target_unavailable(inputs)
});
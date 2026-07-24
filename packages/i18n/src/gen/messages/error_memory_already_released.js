/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Already_ReleasedInputs */

const en_error_memory_already_released = /** @type {(inputs: Error_Memory_Already_ReleasedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That memory has already been let go.`)
};

const ko_error_memory_already_released = /** @type {(inputs: Error_Memory_Already_ReleasedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이미 놓아준 기억이에요.`)
};

/**
* | output |
* | --- |
* | "That memory has already been let go." |
*
* @param {Error_Memory_Already_ReleasedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_already_released = /** @type {((inputs?: Error_Memory_Already_ReleasedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Already_ReleasedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_already_released(inputs)
	return ko_error_memory_already_released(inputs)
});
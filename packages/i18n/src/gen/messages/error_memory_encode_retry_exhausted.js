/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Encode_Retry_ExhaustedInputs */

const en_error_memory_encode_retry_exhausted = /** @type {(inputs: Error_Memory_Encode_Retry_ExhaustedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`We could not split this diary into stars. Trying again may land differently.`)
};

const ko_error_memory_encode_retry_exhausted = /** @type {(inputs: Error_Memory_Encode_Retry_ExhaustedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기를 별로 나누지 못했어요. 다시 시도하면 달라질 수 있어요.`)
};

/**
* | output |
* | --- |
* | "We could not split this diary into stars. Trying again may land differently." |
*
* @param {Error_Memory_Encode_Retry_ExhaustedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_encode_retry_exhausted = /** @type {((inputs?: Error_Memory_Encode_Retry_ExhaustedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Encode_Retry_ExhaustedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_encode_retry_exhausted(inputs)
	return ko_error_memory_encode_retry_exhausted(inputs)
});
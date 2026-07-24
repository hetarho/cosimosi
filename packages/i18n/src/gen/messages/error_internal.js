/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ requestId: NonNullable<unknown> }} Error_InternalInputs */

const en_error_internal = /** @type {(inputs: Error_InternalInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Something went wrong. Reference: ${i?.requestId}`)
};

const ko_error_internal = /** @type {(inputs: Error_InternalInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`문제가 생겼어요. 참조 번호: ${i?.requestId}`)
};

/**
* | output |
* | --- |
* | "Something went wrong. Reference: {requestId}" |
*
* @param {Error_InternalInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_internal = /** @type {((inputs: Error_InternalInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_InternalInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_internal(inputs)
	return ko_error_internal(inputs)
});
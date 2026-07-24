/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Deadline_ExceededInputs */

const en_error_deadline_exceeded = /** @type {(inputs: Error_Deadline_ExceededInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The request took too long. Try again.`)
};

const ko_error_deadline_exceeded = /** @type {(inputs: Error_Deadline_ExceededInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요청 시간이 오래 걸렸어요. 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "The request took too long. Try again." |
*
* @param {Error_Deadline_ExceededInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_deadline_exceeded = /** @type {((inputs?: Error_Deadline_ExceededInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Deadline_ExceededInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_deadline_exceeded(inputs)
	return ko_error_deadline_exceeded(inputs)
});
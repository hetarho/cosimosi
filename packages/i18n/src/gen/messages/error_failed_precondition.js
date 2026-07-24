/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Failed_PreconditionInputs */

const en_error_failed_precondition = /** @type {(inputs: Error_Failed_PreconditionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That action is not available in the current state.`)
};

const ko_error_failed_precondition = /** @type {(inputs: Error_Failed_PreconditionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`현재 상태에서는 이 작업을 할 수 없어요.`)
};

/**
* | output |
* | --- |
* | "That action is not available in the current state." |
*
* @param {Error_Failed_PreconditionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_failed_precondition = /** @type {((inputs?: Error_Failed_PreconditionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Failed_PreconditionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_failed_precondition(inputs)
	return ko_error_failed_precondition(inputs)
});
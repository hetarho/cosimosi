/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Resource_ExhaustedInputs */

const en_error_resource_exhausted = /** @type {(inputs: Error_Resource_ExhaustedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That action cannot be completed with the current allowance.`)
};

const ko_error_resource_exhausted = /** @type {(inputs: Error_Resource_ExhaustedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`현재 한도에서는 이 작업을 마칠 수 없어요.`)
};

/**
* | output |
* | --- |
* | "That action cannot be completed with the current allowance." |
*
* @param {Error_Resource_ExhaustedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_resource_exhausted = /** @type {((inputs?: Error_Resource_ExhaustedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Resource_ExhaustedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_resource_exhausted(inputs)
	return ko_error_resource_exhausted(inputs)
});
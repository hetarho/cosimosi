/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_UnimplementedInputs */

const en_error_unimplemented = /** @type {(inputs: Error_UnimplementedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That action is not available yet.`)
};

const ko_error_unimplemented = /** @type {(inputs: Error_UnimplementedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 사용할 수 없는 기능이에요.`)
};

/**
* | output |
* | --- |
* | "That action is not available yet." |
*
* @param {Error_UnimplementedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_unimplemented = /** @type {((inputs?: Error_UnimplementedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_UnimplementedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_unimplemented(inputs)
	return ko_error_unimplemented(inputs)
});
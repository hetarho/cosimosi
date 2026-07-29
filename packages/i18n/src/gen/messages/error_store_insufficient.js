/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Store_InsufficientInputs */

const en_error_store_insufficient = /** @type {(inputs: Error_Store_InsufficientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not enough stardust — nothing was saved.`)
};

const ko_error_store_insufficient = /** @type {(inputs: Error_Store_InsufficientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루가 모자라 아무것도 저장하지 않았어요.`)
};

/**
* | output |
* | --- |
* | "Not enough stardust — nothing was saved." |
*
* @param {Error_Store_InsufficientInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_store_insufficient = /** @type {((inputs?: Error_Store_InsufficientInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Store_InsufficientInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_store_insufficient(inputs)
	return ko_error_store_insufficient(inputs)
});
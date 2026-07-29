/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Applied_NowInputs */

const en_store_applied_now = /** @type {(inputs: Store_Applied_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Now`)
};

const ko_store_applied_now = /** @type {(inputs: Store_Applied_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금`)
};

/**
* | output |
* | --- |
* | "Now" |
*
* @param {Store_Applied_NowInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_applied_now = /** @type {((inputs?: Store_Applied_NowInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Applied_NowInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_applied_now(inputs)
	return ko_store_applied_now(inputs)
});
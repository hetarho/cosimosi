/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_CreatedInputs */

const en_star_meta_created = /** @type {(inputs: Star_Meta_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Written`)
};

const ko_star_meta_created = /** @type {(inputs: Star_Meta_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`적은 날`)
};

/**
* | output |
* | --- |
* | "Written" |
*
* @param {Star_Meta_CreatedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_created = /** @type {((inputs?: Star_Meta_CreatedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_CreatedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_created(inputs)
	return ko_star_meta_created(inputs)
});
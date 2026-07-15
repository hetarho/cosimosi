/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_BackInputs */

const en_deletion_letgo_back = /** @type {(inputs: Deletion_Letgo_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rewrite`)
};

const ko_deletion_letgo_back = /** @type {(inputs: Deletion_Letgo_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 쓰기`)
};

/**
* | output |
* | --- |
* | "Rewrite" |
*
* @param {Deletion_Letgo_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_back = /** @type {((inputs?: Deletion_Letgo_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_back(inputs)
	return ko_deletion_letgo_back(inputs)
});
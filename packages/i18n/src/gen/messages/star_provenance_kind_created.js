/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_Kind_CreatedInputs */

const en_star_provenance_kind_created = /** @type {(inputs: Star_Provenance_Kind_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Created`)
};

const ko_star_provenance_kind_created = /** @type {(inputs: Star_Provenance_Kind_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`생성`)
};

/**
* | output |
* | --- |
* | "Created" |
*
* @param {Star_Provenance_Kind_CreatedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_kind_created = /** @type {((inputs?: Star_Provenance_Kind_CreatedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_Kind_CreatedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_kind_created(inputs)
	return ko_star_provenance_kind_created(inputs)
});
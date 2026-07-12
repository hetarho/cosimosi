/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_EmptyInputs */

const en_star_provenance_empty = /** @type {(inputs: Star_Provenance_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No history yet.`)
};

const ko_star_provenance_empty = /** @type {(inputs: Star_Provenance_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 변천의 기록이 없어요.`)
};

/**
* | output |
* | --- |
* | "No history yet." |
*
* @param {Star_Provenance_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_empty = /** @type {((inputs?: Star_Provenance_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_empty(inputs)
	return ko_star_provenance_empty(inputs)
});
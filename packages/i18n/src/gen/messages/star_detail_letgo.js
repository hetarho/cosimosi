/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_LetgoInputs */

const en_star_detail_letgo = /** @type {(inputs: Star_Detail_LetgoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let go`)
};

const ko_star_detail_letgo = /** @type {(inputs: Star_Detail_LetgoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아주기`)
};

/**
* | output |
* | --- |
* | "Let go" |
*
* @param {Star_Detail_LetgoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_letgo = /** @type {((inputs?: Star_Detail_LetgoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_LetgoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_letgo(inputs)
	return ko_star_detail_letgo(inputs)
});
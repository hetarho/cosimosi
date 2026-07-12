/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_TitleInputs */

const en_star_detail_title = /** @type {(inputs: Star_Detail_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Look at this star`)
};

const ko_star_detail_title = /** @type {(inputs: Star_Detail_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 살펴보기`)
};

/**
* | output |
* | --- |
* | "Look at this star" |
*
* @param {Star_Detail_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_title = /** @type {((inputs?: Star_Detail_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_title(inputs)
	return ko_star_detail_title(inputs)
});
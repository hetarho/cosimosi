/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_Text_UnavailableInputs */

const en_star_detail_text_unavailable = /** @type {(inputs: Star_Detail_Text_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This memory has not loaded yet.`)
};

const ko_star_detail_text_unavailable = /** @type {(inputs: Star_Detail_Text_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 이 별의 기억을 불러오지 못했어요.`)
};

/**
* | output |
* | --- |
* | "This memory has not loaded yet." |
*
* @param {Star_Detail_Text_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_text_unavailable = /** @type {((inputs?: Star_Detail_Text_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_Text_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_text_unavailable(inputs)
	return ko_star_detail_text_unavailable(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_Delete_SourceInputs */

const en_star_detail_delete_source = /** @type {(inputs: Star_Detail_Delete_SourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete this star's diary`)
};

const ko_star_detail_delete_source = /** @type {(inputs: Star_Detail_Delete_SourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 별의 일기 지우기`)
};

/**
* | output |
* | --- |
* | "Delete this star's diary" |
*
* @param {Star_Detail_Delete_SourceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_delete_source = /** @type {((inputs?: Star_Detail_Delete_SourceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_Delete_SourceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_delete_source(inputs)
	return ko_star_detail_delete_source(inputs)
});
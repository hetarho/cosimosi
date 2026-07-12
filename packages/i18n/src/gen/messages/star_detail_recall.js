/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_RecallInputs */

const en_star_detail_recall = /** @type {(inputs: Star_Detail_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall`)
};

const ko_star_detail_recall = /** @type {(inputs: Star_Detail_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회고하기`)
};

/**
* | output |
* | --- |
* | "Recall" |
*
* @param {Star_Detail_RecallInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_recall = /** @type {((inputs?: Star_Detail_RecallInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_RecallInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_recall(inputs)
	return ko_star_detail_recall(inputs)
});
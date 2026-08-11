/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_Actions_LabelInputs */

const en_star_detail_actions_label = /** @type {(inputs: Star_Detail_Actions_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What you can do with this star`)
};

const ko_star_detail_actions_label = /** @type {(inputs: Star_Detail_Actions_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 별로 할 수 있는 일`)
};

/**
* | output |
* | --- |
* | "What you can do with this star" |
*
* @param {Star_Detail_Actions_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_actions_label = /** @type {((inputs?: Star_Detail_Actions_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_Actions_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_actions_label(inputs)
	return ko_star_detail_actions_label(inputs)
});
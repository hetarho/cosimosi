/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Mirror_Weighted_LabelInputs */

const en_landing_mirror_weighted_label = /** @type {(inputs: Landing_Mirror_Weighted_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What you actually get: weighted by what you returned to`)
};

const ko_landing_mirror_weighted_label = /** @type {(inputs: Landing_Mirror_Weighted_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`실제로 보이는 것: 다시 찾은 만큼 기울어진 색`)
};

/**
* | output |
* | --- |
* | "What you actually get: weighted by what you returned to" |
*
* @param {Landing_Mirror_Weighted_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_mirror_weighted_label = /** @type {((inputs?: Landing_Mirror_Weighted_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Mirror_Weighted_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_mirror_weighted_label(inputs)
	return ko_landing_mirror_weighted_label(inputs)
});
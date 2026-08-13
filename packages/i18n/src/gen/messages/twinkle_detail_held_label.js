/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Detail_Held_LabelInputs */

const en_twinkle_detail_held_label = /** @type {(inputs: Twinkle_Detail_Held_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust you hold now`)
};

const ko_twinkle_detail_held_label = /** @type {(inputs: Twinkle_Detail_Held_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 가진 별가루`)
};

/**
* | output |
* | --- |
* | "Stardust you hold now" |
*
* @param {Twinkle_Detail_Held_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_detail_held_label = /** @type {((inputs?: Twinkle_Detail_Held_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Detail_Held_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_detail_held_label(inputs)
	return ko_twinkle_detail_held_label(inputs)
});
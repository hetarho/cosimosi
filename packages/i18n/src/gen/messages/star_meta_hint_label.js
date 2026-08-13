/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ label: NonNullable<unknown> }} Star_Meta_Hint_LabelInputs */

const en_star_meta_hint_label = /** @type {(inputs: Star_Meta_Hint_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`About ${i?.label}`)
};

const ko_star_meta_hint_label = /** @type {(inputs: Star_Meta_Hint_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.label} 설명 보기`)
};

/**
* | output |
* | --- |
* | "About {label}" |
*
* @param {Star_Meta_Hint_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_hint_label = /** @type {((inputs: Star_Meta_Hint_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Hint_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_hint_label(inputs)
	return ko_star_meta_hint_label(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Split_LabelInputs */

const en_demo_split_label = /** @type {(inputs: Demo_Split_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What it was made of`)
};

const ko_demo_split_label = /** @type {(inputs: Demo_Split_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`무엇으로 이루어졌는지`)
};

/**
* | output |
* | --- |
* | "What it was made of" |
*
* @param {Demo_Split_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_split_label = /** @type {((inputs?: Demo_Split_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Split_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_split_label(inputs)
	return ko_demo_split_label(inputs)
});
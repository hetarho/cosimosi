/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Stars_LabelInputs */

const en_demo_stars_label = /** @type {(inputs: Demo_Stars_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stars sent up`)
};

const ko_demo_stars_label = /** @type {(inputs: Demo_Stars_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`띄운 별들`)
};

/**
* | output |
* | --- |
* | "Stars sent up" |
*
* @param {Demo_Stars_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_stars_label = /** @type {((inputs?: Demo_Stars_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Stars_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_stars_label(inputs)
	return ko_demo_stars_label(inputs)
});
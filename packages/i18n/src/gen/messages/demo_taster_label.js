/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Taster_LabelInputs */

const en_demo_taster_label = /** @type {(inputs: Demo_Taster_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try it on`)
};

const ko_demo_taster_label = /** @type {(inputs: Demo_Taster_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`입혀보기`)
};

/**
* | output |
* | --- |
* | "Try it on" |
*
* @param {Demo_Taster_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_taster_label = /** @type {((inputs?: Demo_Taster_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Taster_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_taster_label(inputs)
	return ko_demo_taster_label(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Timezone_LabelInputs */

const en_me_timezone_label = /** @type {(inputs: Me_Timezone_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Timezone`)
};

const ko_me_timezone_label = /** @type {(inputs: Me_Timezone_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시간대`)
};

/**
* | output |
* | --- |
* | "Timezone" |
*
* @param {Me_Timezone_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_timezone_label = /** @type {((inputs?: Me_Timezone_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Timezone_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_timezone_label(inputs)
	return ko_me_timezone_label(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_OtherInputs */

const en_achievement_axis_other = /** @type {(inputs: Achievement_Axis_OtherInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`More`)
};

const ko_achievement_axis_other = /** @type {(inputs: Achievement_Axis_OtherInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 밖에`)
};

/**
* | output |
* | --- |
* | "More" |
*
* @param {Achievement_Axis_OtherInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_other = /** @type {((inputs?: Achievement_Axis_OtherInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_OtherInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_other(inputs)
	return ko_achievement_axis_other(inputs)
});
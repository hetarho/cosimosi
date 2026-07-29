/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_DecorationInputs */

const en_achievement_axis_decoration = /** @type {(inputs: Achievement_Axis_DecorationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your universe, dressed`)
};

const ko_achievement_axis_decoration = /** @type {(inputs: Achievement_Axis_DecorationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`당신이 꾸민 우주`)
};

/**
* | output |
* | --- |
* | "Your universe, dressed" |
*
* @param {Achievement_Axis_DecorationInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_decoration = /** @type {((inputs?: Achievement_Axis_DecorationInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_DecorationInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_decoration(inputs)
	return ko_achievement_axis_decoration(inputs)
});
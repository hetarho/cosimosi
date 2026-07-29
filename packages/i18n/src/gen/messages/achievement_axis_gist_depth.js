/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Gist_DepthInputs */

const en_achievement_axis_gist_depth = /** @type {(inputs: Achievement_Axis_Gist_DepthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`How far a memory rose`)
};

const ko_achievement_axis_gist_depth = /** @type {(inputs: Achievement_Axis_Gist_DepthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억이 오른 깊이`)
};

/**
* | output |
* | --- |
* | "How far a memory rose" |
*
* @param {Achievement_Axis_Gist_DepthInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_gist_depth = /** @type {((inputs?: Achievement_Axis_Gist_DepthInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Gist_DepthInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_gist_depth(inputs)
	return ko_achievement_axis_gist_depth(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Decoration_20_BodyInputs */

const en_achievement_decoration_20_body = /** @type {(inputs: Achievement_Decoration_20_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This place looks like somewhere you live.`)
};

const ko_achievement_decoration_20_body = /** @type {(inputs: Achievement_Decoration_20_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사는 곳처럼 보여요.`)
};

/**
* | output |
* | --- |
* | "This place looks like somewhere you live." |
*
* @param {Achievement_Decoration_20_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_decoration_20_body = /** @type {((inputs?: Achievement_Decoration_20_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Decoration_20_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_decoration_20_body(inputs)
	return ko_achievement_decoration_20_body(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Decoration_5_BodyInputs */

const en_achievement_decoration_5_body = /** @type {(inputs: Achievement_Decoration_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You keep changing your mind about the sky.`)
};

const ko_achievement_decoration_5_body = /** @type {(inputs: Achievement_Decoration_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘을 두고 계속 마음이 바뀌네요.`)
};

/**
* | output |
* | --- |
* | "You keep changing your mind about the sky." |
*
* @param {Achievement_Decoration_5_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_decoration_5_body = /** @type {((inputs?: Achievement_Decoration_5_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Decoration_5_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_decoration_5_body(inputs)
	return ko_achievement_decoration_5_body(inputs)
});
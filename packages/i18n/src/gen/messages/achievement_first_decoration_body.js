/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Decoration_BodyInputs */

const en_achievement_first_decoration_body = /** @type {(inputs: Achievement_First_Decoration_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky changed because you wanted it to.`)
};

const ko_achievement_first_decoration_body = /** @type {(inputs: Achievement_First_Decoration_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`당신이 원해서 하늘이 달라졌어요.`)
};

/**
* | output |
* | --- |
* | "The sky changed because you wanted it to." |
*
* @param {Achievement_First_Decoration_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_decoration_body = /** @type {((inputs?: Achievement_First_Decoration_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Decoration_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_decoration_body(inputs)
	return ko_achievement_first_decoration_body(inputs)
});
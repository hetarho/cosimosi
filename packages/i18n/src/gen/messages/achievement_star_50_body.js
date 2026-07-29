/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Star_50_BodyInputs */

const en_achievement_star_50_body = /** @type {(inputs: Achievement_Star_50_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Some of them are already dimming, and that is right.`)
};

const ko_achievement_star_50_body = /** @type {(inputs: Achievement_Star_50_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`몇 개는 벌써 어두워지고 있고, 그게 맞아요.`)
};

/**
* | output |
* | --- |
* | "Some of them are already dimming, and that is right." |
*
* @param {Achievement_Star_50_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_star_50_body = /** @type {((inputs?: Achievement_Star_50_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Star_50_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_star_50_body(inputs)
	return ko_achievement_star_50_body(inputs)
});
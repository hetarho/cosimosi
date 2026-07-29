/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Star_200_BodyInputs */

const en_achievement_star_200_body = /** @type {(inputs: Achievement_Star_200_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dense enough that clusters find each other on their own.`)
};

const ko_achievement_star_200_body = /** @type {(inputs: Achievement_Star_200_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`군집이 저절로 서로를 찾을 만큼 빽빽해요.`)
};

/**
* | output |
* | --- |
* | "Dense enough that clusters find each other on their own." |
*
* @param {Achievement_Star_200_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_star_200_body = /** @type {((inputs?: Achievement_Star_200_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Star_200_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_star_200_body(inputs)
	return ko_achievement_star_200_body(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Hero_TitleInputs */

const en_landing_hero_title = /** @type {(inputs: Landing_Hero_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A diary you can look up at.`)
};

const ko_landing_hero_title = /** @type {(inputs: Landing_Hero_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`올려다볼 수 있는 일기.`)
};

/**
* | output |
* | --- |
* | "A diary you can look up at." |
*
* @param {Landing_Hero_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_hero_title = /** @type {((inputs?: Landing_Hero_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Hero_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_hero_title(inputs)
	return ko_landing_hero_title(inputs)
});
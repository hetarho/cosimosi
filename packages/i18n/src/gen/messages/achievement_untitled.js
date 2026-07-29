/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_UntitledInputs */

const en_achievement_untitled = /** @type {(inputs: Achievement_UntitledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A record without a name yet`)
};

const ko_achievement_untitled = /** @type {(inputs: Achievement_UntitledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 이름이 없는 기록`)
};

/**
* | output |
* | --- |
* | "A record without a name yet" |
*
* @param {Achievement_UntitledInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_untitled = /** @type {((inputs?: Achievement_UntitledInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_UntitledInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_untitled(inputs)
	return ko_achievement_untitled(inputs)
});
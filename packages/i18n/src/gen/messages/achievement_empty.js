/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_EmptyInputs */

const en_achievement_empty = /** @type {(inputs: Achievement_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing here yet — it fills as you write.`)
};

const ko_achievement_empty = /** @type {(inputs: Achievement_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 비어 있어요 — 쓰는 만큼 채워집니다.`)
};

/**
* | output |
* | --- |
* | "Nothing here yet — it fills as you write." |
*
* @param {Achievement_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_empty = /** @type {((inputs?: Achievement_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_empty(inputs)
	return ko_achievement_empty(inputs)
});
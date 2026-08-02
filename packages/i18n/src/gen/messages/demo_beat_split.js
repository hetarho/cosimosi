/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_SplitInputs */

const en_demo_beat_split = /** @type {(inputs: Demo_Beat_SplitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One entry holds several scenes. Split it into stars and see what it was made of.`)
};

const ko_demo_beat_split = /** @type {(inputs: Demo_Beat_SplitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 편의 일기에는 여러 장면이 있어요. 별 쪼개기로 무엇으로 이루어졌는지 보세요.`)
};

/**
* | output |
* | --- |
* | "One entry holds several scenes. Split it into stars and see what it was made of." |
*
* @param {Demo_Beat_SplitInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_split = /** @type {((inputs?: Demo_Beat_SplitInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_SplitInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_split(inputs)
	return ko_demo_beat_split(inputs)
});
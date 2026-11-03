/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_ColorInputs */

const en_demo_beat_color = /** @type {(inputs: Demo_Beat_ColorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your memories colour the sky. Stronger memories give their feelings more room.`)
};

const ko_demo_beat_color = /** @type {(inputs: Demo_Beat_ColorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘에는 기억의 감정이 번져요. 강한 기억의 색이 더 넓게 퍼져요.`)
};

/**
* | output |
* | --- |
* | "Your memories colour the sky. Stronger memories give their feelings more room." |
*
* @param {Demo_Beat_ColorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_color = /** @type {((inputs?: Demo_Beat_ColorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_ColorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_color(inputs)
	return ko_demo_beat_color(inputs)
});
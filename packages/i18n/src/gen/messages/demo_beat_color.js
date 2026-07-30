/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_ColorInputs */

const en_demo_beat_color = /** @type {(inputs: Demo_Beat_ColorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky takes its colour from the feelings you return to — a mirror of what you re-read, not an average of everything you wrote.`)
};

const ko_demo_beat_color = /** @type {(inputs: Demo_Beat_ColorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘은 당신이 다시 찾는 감정의 색을 띱니다. 쓴 것 전체의 평균이 아니라, 다시 읽은 것의 거울이에요.`)
};

/**
* | output |
* | --- |
* | "The sky takes its colour from the feelings you return to — a mirror of what you re-read, not an average of everything you wrote." |
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
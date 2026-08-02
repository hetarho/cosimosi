/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Gist_RiseInputs */

const en_demo_beat_gist_rise = /** @type {(inputs: Demo_Beat_Gist_RiseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let more time pass. Some memories keep only their meaning, and rise.`)
};

const ko_demo_beat_gist_rise = /** @type {(inputs: Demo_Beat_Gist_RiseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시간을 더 흘려보내 보세요. 어떤 기억은 의미만 남기고 위로 올라가요.`)
};

/**
* | output |
* | --- |
* | "Let more time pass. Some memories keep only their meaning, and rise." |
*
* @param {Demo_Beat_Gist_RiseInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_gist_rise = /** @type {((inputs?: Demo_Beat_Gist_RiseInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Gist_RiseInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_gist_rise(inputs)
	return ko_demo_beat_gist_rise(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Ornament_TasterInputs */

const en_demo_beat_ornament_taster = /** @type {(inputs: Demo_Beat_Ornament_TasterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open Decorate to try a different sky and a new shape for your stars.`)
};

const ko_demo_beat_ornament_taster = /** @type {(inputs: Demo_Beat_Ornament_TasterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`꾸미기를 열어 다른 하늘과 별의 새로운 모양을 입혀보세요.`)
};

/**
* | output |
* | --- |
* | "Open Decorate to try a different sky and a new shape for your stars." |
*
* @param {Demo_Beat_Ornament_TasterInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_ornament_taster = /** @type {((inputs?: Demo_Beat_Ornament_TasterInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Ornament_TasterInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_ornament_taster(inputs)
	return ko_demo_beat_ornament_taster(inputs)
});
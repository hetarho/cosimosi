/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Ornament_SkyInputs */

const en_demo_beat_ornament_sky = /** @type {(inputs: Demo_Beat_Ornament_SkyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Choose a different sky. The highlighted option changes the sky you are looking at now.`)
};

const ko_demo_beat_ornament_sky = /** @type {(inputs: Demo_Beat_Ornament_SkyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금과 다른 하늘을 골라보세요. 강조된 항목을 누르면 뒤의 하늘이 달라져요.`)
};

/**
* | output |
* | --- |
* | "Choose a different sky. The highlighted option changes the sky you are looking at now." |
*
* @param {Demo_Beat_Ornament_SkyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_ornament_sky = /** @type {((inputs?: Demo_Beat_Ornament_SkyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Ornament_SkyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_ornament_sky(inputs)
	return ko_demo_beat_ornament_sky(inputs)
});
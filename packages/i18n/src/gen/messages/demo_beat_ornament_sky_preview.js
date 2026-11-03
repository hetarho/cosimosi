/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Ornament_Sky_PreviewInputs */

const en_demo_beat_ornament_sky_preview = /** @type {(inputs: Demo_Beat_Ornament_Sky_PreviewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Take in your new sky.`)
};

const ko_demo_beat_ornament_sky_preview = /** @type {(inputs: Demo_Beat_Ornament_Sky_PreviewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`바뀐 하늘을 잠깐 보세요.`)
};

/**
* | output |
* | --- |
* | "Take in your new sky." |
*
* @param {Demo_Beat_Ornament_Sky_PreviewInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_ornament_sky_preview = /** @type {((inputs?: Demo_Beat_Ornament_Sky_PreviewInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Ornament_Sky_PreviewInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_ornament_sky_preview(inputs)
	return ko_demo_beat_ornament_sky_preview(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Ornament_TasterInputs */

const en_demo_beat_ornament_taster = /** @type {(inputs: Demo_Beat_Ornament_TasterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try the place on: the sky behind, the shape a memory takes, the colour a feeling gets. Change one, then close it and come back to the universe.`)
};

const ko_demo_beat_ornament_taster = /** @type {(inputs: Demo_Beat_Ornament_TasterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 공간을 입혀보세요. 뒤의 하늘, 기억이 갖는 모양, 감정이 갖는 색. 하나 골라 바꿔보고, 닫고 우주로 돌아오세요.`)
};

/**
* | output |
* | --- |
* | "Try the place on: the sky behind, the shape a memory takes, the colour a feeling gets. Change one, then close it and come back to the universe." |
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
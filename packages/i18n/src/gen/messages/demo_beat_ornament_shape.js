/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Ornament_ShapeInputs */

const en_demo_beat_ornament_shape = /** @type {(inputs: Demo_Beat_Ornament_ShapeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Now look at this star up close. The panel has moved to Star shape. Try a different form.`)
};

const ko_demo_beat_ornament_shape = /** @type {(inputs: Demo_Beat_Ornament_ShapeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이제 별을 가까이 보세요. 패널을 별 모양으로 옮겼어요. 다른 모양을 골라 바뀌는 모습을 확인해 보세요.`)
};

/**
* | output |
* | --- |
* | "Now look at this star up close. The panel has moved to Star shape. Try a different form." |
*
* @param {Demo_Beat_Ornament_ShapeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_ornament_shape = /** @type {((inputs?: Demo_Beat_Ornament_ShapeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Ornament_ShapeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_ornament_shape(inputs)
	return ko_demo_beat_ornament_shape(inputs)
});
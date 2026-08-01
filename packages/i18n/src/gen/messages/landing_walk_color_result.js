/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Color_ResultInputs */

const en_landing_walk_color_result = /** @type {(inputs: Landing_Walk_Color_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky settles into what the entries hold. A mostly quiet week gives it a mostly quiet colour.`)
};

const ko_landing_walk_color_result = /** @type {(inputs: Landing_Walk_Color_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기록이 쌓인 만큼 하늘이 물들었어요. 조용한 날이 많았던 한 주라, 하늘도 조용한 색이에요.`)
};

/**
* | output |
* | --- |
* | "The sky settles into what the entries hold. A mostly quiet week gives it a mostly quiet colour." |
*
* @param {Landing_Walk_Color_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_color_result = /** @type {((inputs?: Landing_Walk_Color_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Color_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_color_result(inputs)
	return ko_landing_walk_color_result(inputs)
});
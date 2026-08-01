/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Color_TitleInputs */

const en_landing_walk_color_title = /** @type {(inputs: Landing_Walk_Color_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky takes the colours you keep`)
};

const ko_landing_walk_color_title = /** @type {(inputs: Landing_Walk_Color_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주가 내가 담는 색으로 물들어요`)
};

/**
* | output |
* | --- |
* | "The sky takes the colours you keep" |
*
* @param {Landing_Walk_Color_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_color_title = /** @type {((inputs?: Landing_Walk_Color_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Color_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_color_title(inputs)
	return ko_landing_walk_color_title(inputs)
});
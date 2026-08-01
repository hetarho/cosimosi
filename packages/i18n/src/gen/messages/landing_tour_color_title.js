/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Color_TitleInputs */

const en_landing_tour_color_title = /** @type {(inputs: Landing_Tour_Color_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky takes your colour`)
};

const ko_landing_tour_color_title = /** @type {(inputs: Landing_Tour_Color_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘이 내 색으로 물들어요`)
};

/**
* | output |
* | --- |
* | "The sky takes your colour" |
*
* @param {Landing_Tour_Color_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_color_title = /** @type {((inputs?: Landing_Tour_Color_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Color_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_color_title(inputs)
	return ko_landing_tour_color_title(inputs)
});
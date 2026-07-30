/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_TitleInputs */

const en_landing_tour_title = /** @type {(inputs: Landing_Tour_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What happens, in order`)
};

const ko_landing_tour_title = /** @type {(inputs: Landing_Tour_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일어나는 일, 순서대로`)
};

/**
* | output |
* | --- |
* | "What happens, in order" |
*
* @param {Landing_Tour_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_title = /** @type {((inputs?: Landing_Tour_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_title(inputs)
	return ko_landing_tour_title(inputs)
});
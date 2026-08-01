/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Constellate_TitleInputs */

const en_landing_tour_constellate_title = /** @type {(inputs: Landing_Tour_Constellate_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`They find each other`)
};

const ko_landing_tour_constellate_title = /** @type {(inputs: Landing_Tour_Constellate_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`서로를 찾아내요`)
};

/**
* | output |
* | --- |
* | "They find each other" |
*
* @param {Landing_Tour_Constellate_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_constellate_title = /** @type {((inputs?: Landing_Tour_Constellate_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Constellate_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_constellate_title(inputs)
	return ko_landing_tour_constellate_title(inputs)
});
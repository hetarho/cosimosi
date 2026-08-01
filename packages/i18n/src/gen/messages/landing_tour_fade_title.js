/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Fade_TitleInputs */

const en_landing_tour_fade_title = /** @type {(inputs: Landing_Tour_Fade_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What you never return to dims`)
};

const ko_landing_tour_fade_title = /** @type {(inputs: Landing_Tour_Fade_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 찾지 않으면 어두워져요`)
};

/**
* | output |
* | --- |
* | "What you never return to dims" |
*
* @param {Landing_Tour_Fade_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_fade_title = /** @type {((inputs?: Landing_Tour_Fade_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Fade_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_fade_title(inputs)
	return ko_landing_tour_fade_title(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Write_TitleInputs */

const en_landing_tour_write_title = /** @type {(inputs: Landing_Tour_Write_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You write a day`)
};

const ko_landing_tour_write_title = /** @type {(inputs: Landing_Tour_Write_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하루를 씁니다`)
};

/**
* | output |
* | --- |
* | "You write a day" |
*
* @param {Landing_Tour_Write_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_write_title = /** @type {((inputs?: Landing_Tour_Write_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Write_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_write_title(inputs)
	return ko_landing_tour_write_title(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Floating_LinesInputs */

const en_store_ornament_background_floating_lines = /** @type {(inputs: Store_Ornament_Background_Floating_LinesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Floating Lines`)
};

const ko_store_ornament_background_floating_lines = /** @type {(inputs: Store_Ornament_Background_Floating_LinesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠 있는 선`)
};

/**
* | output |
* | --- |
* | "Floating Lines" |
*
* @param {Store_Ornament_Background_Floating_LinesInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_floating_lines = /** @type {((inputs?: Store_Ornament_Background_Floating_LinesInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Floating_LinesInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_floating_lines(inputs)
	return ko_store_ornament_background_floating_lines(inputs)
});
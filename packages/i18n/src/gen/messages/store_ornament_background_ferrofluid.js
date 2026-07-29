/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_FerrofluidInputs */

const en_store_ornament_background_ferrofluid = /** @type {(inputs: Store_Ornament_Background_FerrofluidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ferrofluid`)
};

const ko_store_ornament_background_ferrofluid = /** @type {(inputs: Store_Ornament_Background_FerrofluidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`페로플루이드`)
};

/**
* | output |
* | --- |
* | "Ferrofluid" |
*
* @param {Store_Ornament_Background_FerrofluidInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_ferrofluid = /** @type {((inputs?: Store_Ornament_Background_FerrofluidInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_FerrofluidInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_ferrofluid(inputs)
	return ko_store_ornament_background_ferrofluid(inputs)
});
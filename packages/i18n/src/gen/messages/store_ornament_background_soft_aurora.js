/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Soft_AuroraInputs */

const en_store_ornament_background_soft_aurora = /** @type {(inputs: Store_Ornament_Background_Soft_AuroraInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Soft Aurora`)
};

const ko_store_ornament_background_soft_aurora = /** @type {(inputs: Store_Ornament_Background_Soft_AuroraInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`부드러운 오로라`)
};

/**
* | output |
* | --- |
* | "Soft Aurora" |
*
* @param {Store_Ornament_Background_Soft_AuroraInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_soft_aurora = /** @type {((inputs?: Store_Ornament_Background_Soft_AuroraInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Soft_AuroraInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_soft_aurora(inputs)
	return ko_store_ornament_background_soft_aurora(inputs)
});
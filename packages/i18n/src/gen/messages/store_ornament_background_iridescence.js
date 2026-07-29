/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_IridescenceInputs */

const en_store_ornament_background_iridescence = /** @type {(inputs: Store_Ornament_Background_IridescenceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Iridescence`)
};

const ko_store_ornament_background_iridescence = /** @type {(inputs: Store_Ornament_Background_IridescenceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이리데센스`)
};

/**
* | output |
* | --- |
* | "Iridescence" |
*
* @param {Store_Ornament_Background_IridescenceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_iridescence = /** @type {((inputs?: Store_Ornament_Background_IridescenceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_IridescenceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_iridescence(inputs)
	return ko_store_ornament_background_iridescence(inputs)
});
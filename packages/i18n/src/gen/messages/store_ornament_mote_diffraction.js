/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_DiffractionInputs */

const en_store_ornament_mote_diffraction = /** @type {(inputs: Store_Ornament_Mote_DiffractionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diffraction`)
};

const ko_store_ornament_mote_diffraction = /** @type {(inputs: Store_Ornament_Mote_DiffractionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회절 십자`)
};

/**
* | output |
* | --- |
* | "Diffraction" |
*
* @param {Store_Ornament_Mote_DiffractionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_diffraction = /** @type {((inputs?: Store_Ornament_Mote_DiffractionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_DiffractionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_diffraction(inputs)
	return ko_store_ornament_mote_diffraction(inputs)
});
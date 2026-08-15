/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Galaxy_DustInputs */

const en_store_ornament_mote_galaxy_dust = /** @type {(inputs: Store_Ornament_Mote_Galaxy_DustInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Galaxy Dust`)
};

const ko_store_ornament_mote_galaxy_dust = /** @type {(inputs: Store_Ornament_Mote_Galaxy_DustInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`은하 먼지`)
};

/**
* | output |
* | --- |
* | "Galaxy Dust" |
*
* @param {Store_Ornament_Mote_Galaxy_DustInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_galaxy_dust = /** @type {((inputs?: Store_Ornament_Mote_Galaxy_DustInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Galaxy_DustInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_galaxy_dust(inputs)
	return ko_store_ornament_mote_galaxy_dust(inputs)
});
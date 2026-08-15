/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_OrbInputs */

const en_store_ornament_mote_orb = /** @type {(inputs: Store_Ornament_Mote_OrbInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Orb`)
};

const ko_store_ornament_mote_orb = /** @type {(inputs: Store_Ornament_Mote_OrbInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`둥근 알`)
};

/**
* | output |
* | --- |
* | "Orb" |
*
* @param {Store_Ornament_Mote_OrbInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_orb = /** @type {((inputs?: Store_Ornament_Mote_OrbInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_OrbInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_orb(inputs)
	return ko_store_ornament_mote_orb(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Ice_SparkInputs */

const en_store_ornament_mote_ice_spark = /** @type {(inputs: Store_Ornament_Mote_Ice_SparkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ice Spark`)
};

const ko_store_ornament_mote_ice_spark = /** @type {(inputs: Store_Ornament_Mote_Ice_SparkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`얼음 불꽃`)
};

/**
* | output |
* | --- |
* | "Ice Spark" |
*
* @param {Store_Ornament_Mote_Ice_SparkInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_ice_spark = /** @type {((inputs?: Store_Ornament_Mote_Ice_SparkInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Ice_SparkInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_ice_spark(inputs)
	return ko_store_ornament_mote_ice_spark(inputs)
});
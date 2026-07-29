/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_GrainientInputs */

const en_store_ornament_background_grainient = /** @type {(inputs: Store_Ornament_Background_GrainientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Grainient`)
};

const ko_store_ornament_background_grainient = /** @type {(inputs: Store_Ornament_Background_GrainientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그레이니언트`)
};

/**
* | output |
* | --- |
* | "Grainient" |
*
* @param {Store_Ornament_Background_GrainientInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_grainient = /** @type {((inputs?: Store_Ornament_Background_GrainientInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_GrainientInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_grainient(inputs)
	return ko_store_ornament_background_grainient(inputs)
});
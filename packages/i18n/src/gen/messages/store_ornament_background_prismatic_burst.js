/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Prismatic_BurstInputs */

const en_store_ornament_background_prismatic_burst = /** @type {(inputs: Store_Ornament_Background_Prismatic_BurstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Prismatic Burst`)
};

const ko_store_ornament_background_prismatic_burst = /** @type {(inputs: Store_Ornament_Background_Prismatic_BurstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`프리즘 버스트`)
};

/**
* | output |
* | --- |
* | "Prismatic Burst" |
*
* @param {Store_Ornament_Background_Prismatic_BurstInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_prismatic_burst = /** @type {((inputs?: Store_Ornament_Background_Prismatic_BurstInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Prismatic_BurstInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_prismatic_burst(inputs)
	return ko_store_ornament_background_prismatic_burst(inputs)
});
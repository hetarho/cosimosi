/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Liquid_EtherInputs */

const en_store_ornament_background_liquid_ether = /** @type {(inputs: Store_Ornament_Background_Liquid_EtherInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Liquid Ether`)
};

const ko_store_ornament_background_liquid_ether = /** @type {(inputs: Store_Ornament_Background_Liquid_EtherInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`리퀴드 에테르`)
};

/**
* | output |
* | --- |
* | "Liquid Ether" |
*
* @param {Store_Ornament_Background_Liquid_EtherInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_liquid_ether = /** @type {((inputs?: Store_Ornament_Background_Liquid_EtherInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Liquid_EtherInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_liquid_ether(inputs)
	return ko_store_ornament_background_liquid_ether(inputs)
});
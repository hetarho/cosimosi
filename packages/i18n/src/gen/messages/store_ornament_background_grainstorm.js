/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_GrainstormInputs */

const en_store_ornament_background_grainstorm = /** @type {(inputs: Store_Ornament_Background_GrainstormInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Grainstorm`)
};

const ko_store_ornament_background_grainstorm = /** @type {(inputs: Store_Ornament_Background_GrainstormInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그레인스톰`)
};

/**
* | output |
* | --- |
* | "Grainstorm" |
*
* @param {Store_Ornament_Background_GrainstormInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_grainstorm = /** @type {((inputs?: Store_Ornament_Background_GrainstormInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_GrainstormInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_grainstorm(inputs)
	return ko_store_ornament_background_grainstorm(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Evil_EyeInputs */

const en_store_ornament_background_evil_eye = /** @type {(inputs: Store_Ornament_Background_Evil_EyeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Evil Eye`)
};

const ko_store_ornament_background_evil_eye = /** @type {(inputs: Store_Ornament_Background_Evil_EyeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이블 아이`)
};

/**
* | output |
* | --- |
* | "Evil Eye" |
*
* @param {Store_Ornament_Background_Evil_EyeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_evil_eye = /** @type {((inputs?: Store_Ornament_Background_Evil_EyeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Evil_EyeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_evil_eye(inputs)
	return ko_store_ornament_background_evil_eye(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_BackInputs */

const en_settings_back = /** @type {(inputs: Settings_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to the universe`)
};

const ko_settings_back = /** @type {(inputs: Settings_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Back to the universe" |
*
* @param {Settings_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_back = /** @type {((inputs?: Settings_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_back(inputs)
	return ko_settings_back(inputs)
});
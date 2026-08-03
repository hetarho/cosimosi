/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Home_SettingsInputs */

const en_universe_home_settings = /** @type {(inputs: Universe_Home_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Settings`)
};

const ko_universe_home_settings = /** @type {(inputs: Universe_Home_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`설정`)
};

/**
* | output |
* | --- |
* | "Settings" |
*
* @param {Universe_Home_SettingsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_home_settings = /** @type {((inputs?: Universe_Home_SettingsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Home_SettingsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_home_settings(inputs)
	return ko_universe_home_settings(inputs)
});
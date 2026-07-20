/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Section_AccountInputs */

const en_settings_section_account = /** @type {(inputs: Settings_Section_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Account`)
};

const ko_settings_section_account = /** @type {(inputs: Settings_Section_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계정`)
};

/**
* | output |
* | --- |
* | "Account" |
*
* @param {Settings_Section_AccountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_section_account = /** @type {((inputs?: Settings_Section_AccountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Section_AccountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_section_account(inputs)
	return ko_settings_section_account(inputs)
});
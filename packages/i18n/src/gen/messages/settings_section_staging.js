/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Section_StagingInputs */

const en_settings_section_staging = /** @type {(inputs: Settings_Section_StagingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Staging`)
};

const ko_settings_section_staging = /** @type {(inputs: Settings_Section_StagingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`연출`)
};

/**
* | output |
* | --- |
* | "Staging" |
*
* @param {Settings_Section_StagingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_section_staging = /** @type {((inputs?: Settings_Section_StagingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Section_StagingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_section_staging(inputs)
	return ko_settings_section_staging(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Identity_LabelInputs */

const en_settings_identity_label = /** @type {(inputs: Settings_Identity_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Signed in as`)
};

const ko_settings_identity_label = /** @type {(inputs: Settings_Identity_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`로그인한 계정`)
};

/**
* | output |
* | --- |
* | "Signed in as" |
*
* @param {Settings_Identity_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_identity_label = /** @type {((inputs?: Settings_Identity_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Identity_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_identity_label(inputs)
	return ko_settings_identity_label(inputs)
});
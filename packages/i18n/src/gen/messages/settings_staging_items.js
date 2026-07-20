/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Staging_ItemsInputs */

const en_settings_staging_items = /** @type {(inputs: Settings_Staging_ItemsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Background · Theme · Effect · Camera mood`)
};

const ko_settings_staging_items = /** @type {(inputs: Settings_Staging_ItemsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`배경 · 테마 · 효과 · 카메라 무드`)
};

/**
* | output |
* | --- |
* | "Background · Theme · Effect · Camera mood" |
*
* @param {Settings_Staging_ItemsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_staging_items = /** @type {((inputs?: Settings_Staging_ItemsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Staging_ItemsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_staging_items(inputs)
	return ko_settings_staging_items(inputs)
});
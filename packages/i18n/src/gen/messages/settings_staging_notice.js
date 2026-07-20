/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Staging_NoticeInputs */

const en_settings_staging_notice = /** @type {(inputs: Settings_Staging_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This space opens later.`)
};

const ko_settings_staging_notice = /** @type {(inputs: Settings_Staging_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이후에 열릴 자리예요.`)
};

/**
* | output |
* | --- |
* | "This space opens later." |
*
* @param {Settings_Staging_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_staging_notice = /** @type {((inputs?: Settings_Staging_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Staging_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_staging_notice(inputs)
	return ko_settings_staging_notice(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Staging_BoundaryInputs */

const en_settings_staging_boundary = /** @type {(inputs: Settings_Staging_BoundaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Staging only changes how things appear. Color stays emotion; a star's place and strength stay untouched.`)
};

const ko_settings_staging_boundary = /** @type {(inputs: Settings_Staging_BoundaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`연출은 보이는 방식만 바꿉니다. 색은 감정 그대로, 별의 자리와 세기도 그대로예요.`)
};

/**
* | output |
* | --- |
* | "Staging only changes how things appear. Color stays emotion; a star's place and strength stay untouched." |
*
* @param {Settings_Staging_BoundaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_staging_boundary = /** @type {((inputs?: Settings_Staging_BoundaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Staging_BoundaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_staging_boundary(inputs)
	return ko_settings_staging_boundary(inputs)
});
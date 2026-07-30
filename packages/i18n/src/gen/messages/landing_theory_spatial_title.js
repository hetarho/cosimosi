/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Spatial_TitleInputs */

const en_landing_theory_spatial_title = /** @type {(inputs: Landing_Theory_Spatial_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The brain reuses its sense of place`)
};

const ko_landing_theory_spatial_title = /** @type {(inputs: Landing_Theory_Spatial_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`뇌는 장소 감각을 다시 씁니다`)
};

/**
* | output |
* | --- |
* | "The brain reuses its sense of place" |
*
* @param {Landing_Theory_Spatial_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_spatial_title = /** @type {((inputs?: Landing_Theory_Spatial_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Spatial_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_spatial_title(inputs)
	return ko_landing_theory_spatial_title(inputs)
});
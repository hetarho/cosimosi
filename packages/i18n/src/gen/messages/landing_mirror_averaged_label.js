/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Mirror_Averaged_LabelInputs */

const en_landing_mirror_averaged_label = /** @type {(inputs: Landing_Mirror_Averaged_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`If it were the average of every entry`)
};

const ko_landing_mirror_averaged_label = /** @type {(inputs: Landing_Mirror_Averaged_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모든 기록의 평균이었다면`)
};

/**
* | output |
* | --- |
* | "If it were the average of every entry" |
*
* @param {Landing_Mirror_Averaged_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_mirror_averaged_label = /** @type {((inputs?: Landing_Mirror_Averaged_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Mirror_Averaged_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_mirror_averaged_label(inputs)
	return ko_landing_mirror_averaged_label(inputs)
});
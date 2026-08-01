/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Mirror_TitleInputs */

const en_landing_mirror_title = /** @type {(inputs: Landing_Mirror_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your sky is a mirror, not an average`)
};

const ko_landing_mirror_title = /** @type {(inputs: Landing_Mirror_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘은 평균이 아니라 거울이에요`)
};

/**
* | output |
* | --- |
* | "Your sky is a mirror, not an average" |
*
* @param {Landing_Mirror_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_mirror_title = /** @type {((inputs?: Landing_Mirror_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Mirror_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_mirror_title(inputs)
	return ko_landing_mirror_title(inputs)
});
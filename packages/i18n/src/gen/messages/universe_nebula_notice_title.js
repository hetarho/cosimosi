/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Nebula_Notice_TitleInputs */

const en_universe_nebula_notice_title = /** @type {(inputs: Universe_Nebula_Notice_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The universe's hue`)
};

const ko_universe_nebula_notice_title = /** @type {(inputs: Universe_Nebula_Notice_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 빛깔`)
};

/**
* | output |
* | --- |
* | "The universe's hue" |
*
* @param {Universe_Nebula_Notice_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_nebula_notice_title = /** @type {((inputs?: Universe_Nebula_Notice_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Nebula_Notice_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_nebula_notice_title(inputs)
	return ko_universe_nebula_notice_title(inputs)
});
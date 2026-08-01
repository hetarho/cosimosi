/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Engram_TitleInputs */

const en_landing_theory_engram_title = /** @type {(inputs: Landing_Theory_Engram_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A memory has a physical trace`)
};

const ko_landing_theory_engram_title = /** @type {(inputs: Landing_Theory_Engram_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억은 물리적인 흔적을 남겨요`)
};

/**
* | output |
* | --- |
* | "A memory has a physical trace" |
*
* @param {Landing_Theory_Engram_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_engram_title = /** @type {((inputs?: Landing_Theory_Engram_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Engram_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_engram_title(inputs)
	return ko_landing_theory_engram_title(inputs)
});
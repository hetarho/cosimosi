/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Forgetting_TitleInputs */

const en_landing_theory_forgetting_title = /** @type {(inputs: Landing_Theory_Forgetting_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Forgetting is often losing the way in`)
};

const ko_landing_theory_forgetting_title = /** @type {(inputs: Landing_Theory_Forgetting_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`잊는 일은 대개 길을 잃는 것입니다`)
};

/**
* | output |
* | --- |
* | "Forgetting is often losing the way in" |
*
* @param {Landing_Theory_Forgetting_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_forgetting_title = /** @type {((inputs?: Landing_Theory_Forgetting_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Forgetting_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_forgetting_title(inputs)
	return ko_landing_theory_forgetting_title(inputs)
});
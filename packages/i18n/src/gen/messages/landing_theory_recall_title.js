/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Recall_TitleInputs */

const en_landing_theory_recall_title = /** @type {(inputs: Landing_Theory_Recall_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recalling is rebuilding`)
};

const ko_landing_theory_recall_title = /** @type {(inputs: Landing_Theory_Recall_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회상은 다시 짓는 일입니다`)
};

/**
* | output |
* | --- |
* | "Recalling is rebuilding" |
*
* @param {Landing_Theory_Recall_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_recall_title = /** @type {((inputs?: Landing_Theory_Recall_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Recall_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_recall_title(inputs)
	return ko_landing_theory_recall_title(inputs)
});
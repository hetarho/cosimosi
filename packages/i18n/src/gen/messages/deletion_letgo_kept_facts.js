/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Kept_FactsInputs */

const en_deletion_letgo_kept_facts = /** @type {(inputs: Deletion_Letgo_Kept_FactsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The emotion, the time, the place, the subject, the color, and the star itself all stay.`)
};

const ko_deletion_letgo_kept_facts = /** @type {(inputs: Deletion_Letgo_Kept_FactsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정과 시간, 공간과 대상, 색, 그리고 별 자체는 그대로 남아요.`)
};

/**
* | output |
* | --- |
* | "The emotion, the time, the place, the subject, the color, and the star itself all stay." |
*
* @param {Deletion_Letgo_Kept_FactsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_kept_facts = /** @type {((inputs?: Deletion_Letgo_Kept_FactsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Kept_FactsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_kept_facts(inputs)
	return ko_deletion_letgo_kept_facts(inputs)
});
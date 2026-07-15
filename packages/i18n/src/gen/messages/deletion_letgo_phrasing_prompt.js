/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Phrasing_PromptInputs */

const en_deletion_letgo_phrasing_prompt = /** @type {(inputs: Deletion_Letgo_Phrasing_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write the words or meaning you want to let go of.`)
};

const ko_deletion_letgo_phrasing_prompt = /** @type {(inputs: Deletion_Letgo_Phrasing_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아주고 싶은 말이나 의미를 적어 주세요.`)
};

/**
* | output |
* | --- |
* | "Write the words or meaning you want to let go of." |
*
* @param {Deletion_Letgo_Phrasing_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_phrasing_prompt = /** @type {((inputs?: Deletion_Letgo_Phrasing_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Phrasing_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_phrasing_prompt(inputs)
	return ko_deletion_letgo_phrasing_prompt(inputs)
});
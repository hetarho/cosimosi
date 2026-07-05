/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Merge_ActionInputs */

const en_writing_flow_merge_action = /** @type {(inputs: Writing_Flow_Merge_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Merge with next`)
};

const ko_writing_flow_merge_action = /** @type {(inputs: Writing_Flow_Merge_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다음과 합치기`)
};

/**
* | output |
* | --- |
* | "Merge with next" |
*
* @param {Writing_Flow_Merge_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_merge_action = /** @type {((inputs?: Writing_Flow_Merge_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Merge_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_merge_action(inputs)
	return ko_writing_flow_merge_action(inputs)
});
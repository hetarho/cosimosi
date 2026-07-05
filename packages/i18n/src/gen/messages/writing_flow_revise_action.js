/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Revise_ActionInputs */

const en_writing_flow_revise_action = /** @type {(inputs: Writing_Flow_Revise_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rework in words`)
};

const ko_writing_flow_revise_action = /** @type {(inputs: Writing_Flow_Revise_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`말로 고치기`)
};

/**
* | output |
* | --- |
* | "Rework in words" |
*
* @param {Writing_Flow_Revise_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_revise_action = /** @type {((inputs?: Writing_Flow_Revise_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Revise_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_revise_action(inputs)
	return ko_writing_flow_revise_action(inputs)
});
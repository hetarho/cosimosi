/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_SplittingInputs */

const en_writing_flow_splitting = /** @type {(inputs: Writing_Flow_SplittingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Splitting…`)
};

const ko_writing_flow_splitting = /** @type {(inputs: Writing_Flow_SplittingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쪼개는 중`)
};

/**
* | output |
* | --- |
* | "Splitting…" |
*
* @param {Writing_Flow_SplittingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_splitting = /** @type {((inputs?: Writing_Flow_SplittingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_SplittingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_splitting(inputs)
	return ko_writing_flow_splitting(inputs)
});
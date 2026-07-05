/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_RevisingInputs */

const en_writing_flow_revising = /** @type {(inputs: Writing_Flow_RevisingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reworking…`)
};

const ko_writing_flow_revising = /** @type {(inputs: Writing_Flow_RevisingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 쪼개는 중`)
};

/**
* | output |
* | --- |
* | "Reworking…" |
*
* @param {Writing_Flow_RevisingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_revising = /** @type {((inputs?: Writing_Flow_RevisingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_RevisingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_revising(inputs)
	return ko_writing_flow_revising(inputs)
});
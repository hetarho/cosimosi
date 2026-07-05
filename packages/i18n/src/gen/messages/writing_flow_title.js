/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_TitleInputs */

const en_writing_flow_title = /** @type {(inputs: Writing_Flow_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write a diary`)
};

const ko_writing_flow_title = /** @type {(inputs: Writing_Flow_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 쓰기`)
};

/**
* | output |
* | --- |
* | "Write a diary" |
*
* @param {Writing_Flow_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_title = /** @type {((inputs?: Writing_Flow_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_title(inputs)
	return ko_writing_flow_title(inputs)
});
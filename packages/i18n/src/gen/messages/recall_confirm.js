/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_ConfirmInputs */

const en_recall_confirm = /** @type {(inputs: Recall_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall it`)
};

const ko_recall_confirm = /** @type {(inputs: Recall_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠올리기`)
};

/**
* | output |
* | --- |
* | "Recall it" |
*
* @param {Recall_ConfirmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_confirm = /** @type {((inputs?: Recall_ConfirmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_ConfirmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_confirm(inputs)
	return ko_recall_confirm(inputs)
});
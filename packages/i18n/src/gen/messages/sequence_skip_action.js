/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Skip_ActionInputs */

const en_sequence_skip_action = /** @type {(inputs: Sequence_Skip_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Skip`)
};

const ko_sequence_skip_action = /** @type {(inputs: Sequence_Skip_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`건너뛰기`)
};

/**
* | output |
* | --- |
* | "Skip" |
*
* @param {Sequence_Skip_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_skip_action = /** @type {((inputs?: Sequence_Skip_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Skip_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_skip_action(inputs)
	return ko_sequence_skip_action(inputs)
});
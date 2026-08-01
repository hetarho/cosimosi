/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_RecallInputs */

const en_landing_play_recall = /** @type {(inputs: Landing_Play_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall it`)
};

const ko_landing_play_recall = /** @type {(inputs: Landing_Play_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 떠올리기`)
};

/**
* | output |
* | --- |
* | "Recall it" |
*
* @param {Landing_Play_RecallInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_recall = /** @type {((inputs?: Landing_Play_RecallInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_RecallInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_recall(inputs)
	return ko_landing_play_recall(inputs)
});
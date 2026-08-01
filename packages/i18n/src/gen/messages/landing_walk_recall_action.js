/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Recall_ActionInputs */

const en_landing_walk_recall_action = /** @type {(inputs: Landing_Walk_Recall_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall it`)
};

const ko_landing_walk_recall_action = /** @type {(inputs: Landing_Walk_Recall_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회고하기`)
};

/**
* | output |
* | --- |
* | "Recall it" |
*
* @param {Landing_Walk_Recall_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_recall_action = /** @type {((inputs?: Landing_Walk_Recall_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Recall_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_recall_action(inputs)
	return ko_landing_walk_recall_action(inputs)
});
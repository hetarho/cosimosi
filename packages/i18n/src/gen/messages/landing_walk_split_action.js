/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Split_ActionInputs */

const en_landing_walk_split_action = /** @type {(inputs: Landing_Walk_Split_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Split into stars`)
};

const ko_landing_walk_split_action = /** @type {(inputs: Landing_Walk_Split_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 쪼개기`)
};

/**
* | output |
* | --- |
* | "Split into stars" |
*
* @param {Landing_Walk_Split_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_split_action = /** @type {((inputs?: Landing_Walk_Split_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Split_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_split_action(inputs)
	return ko_landing_walk_split_action(inputs)
});
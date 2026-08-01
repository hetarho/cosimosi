/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Mirror_ActionInputs */

const en_landing_walk_mirror_action = /** @type {(inputs: Landing_Walk_Mirror_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall it a few more times`)
};

const ko_landing_walk_mirror_action = /** @type {(inputs: Landing_Walk_Mirror_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`몇 번 더 회고하기`)
};

/**
* | output |
* | --- |
* | "Recall it a few more times" |
*
* @param {Landing_Walk_Mirror_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_mirror_action = /** @type {((inputs?: Landing_Walk_Mirror_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Mirror_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_mirror_action(inputs)
	return ko_landing_walk_mirror_action(inputs)
});
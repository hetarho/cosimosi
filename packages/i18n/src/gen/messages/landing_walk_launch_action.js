/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Launch_ActionInputs */

const en_landing_walk_launch_action = /** @type {(inputs: Landing_Walk_Launch_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Send up the stars`)
};

const ko_landing_walk_launch_action = /** @type {(inputs: Landing_Walk_Launch_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 띄우기`)
};

/**
* | output |
* | --- |
* | "Send up the stars" |
*
* @param {Landing_Walk_Launch_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_launch_action = /** @type {((inputs?: Landing_Walk_Launch_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Launch_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_launch_action(inputs)
	return ko_landing_walk_launch_action(inputs)
});
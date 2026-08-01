/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Fade_ActionInputs */

const en_landing_walk_fade_action = /** @type {(inputs: Landing_Walk_Fade_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let time pass`)
};

const ko_landing_walk_fade_action = /** @type {(inputs: Landing_Walk_Fade_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시간 흘려보내기`)
};

/**
* | output |
* | --- |
* | "Let time pass" |
*
* @param {Landing_Walk_Fade_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_fade_action = /** @type {((inputs?: Landing_Walk_Fade_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Fade_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_fade_action(inputs)
	return ko_landing_walk_fade_action(inputs)
});
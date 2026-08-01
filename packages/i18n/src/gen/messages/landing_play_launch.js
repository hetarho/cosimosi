/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_LaunchInputs */

const en_landing_play_launch = /** @type {(inputs: Landing_Play_LaunchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let it rise`)
};

const ko_landing_play_launch = /** @type {(inputs: Landing_Play_LaunchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`밤하늘에 띄우기`)
};

/**
* | output |
* | --- |
* | "Let it rise" |
*
* @param {Landing_Play_LaunchInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_launch = /** @type {((inputs?: Landing_Play_LaunchInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_LaunchInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_launch(inputs)
	return ko_landing_play_launch(inputs)
});
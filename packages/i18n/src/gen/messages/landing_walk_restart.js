/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_RestartInputs */

const en_landing_walk_restart = /** @type {(inputs: Landing_Walk_RestartInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watch it again from the start`)
};

const ko_landing_walk_restart = /** @type {(inputs: Landing_Walk_RestartInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음부터 다시 보기`)
};

/**
* | output |
* | --- |
* | "Watch it again from the start" |
*
* @param {Landing_Walk_RestartInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_restart = /** @type {((inputs?: Landing_Walk_RestartInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_RestartInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_restart(inputs)
	return ko_landing_walk_restart(inputs)
});
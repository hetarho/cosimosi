/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Split_TitleInputs */

const en_landing_walk_split_title = /** @type {(inputs: Landing_Walk_Split_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write, and it comes apart into scenes`)
};

const ko_landing_walk_split_title = /** @type {(inputs: Landing_Walk_Split_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쓰면, 장면으로 쪼개져요`)
};

/**
* | output |
* | --- |
* | "Write, and it comes apart into scenes" |
*
* @param {Landing_Walk_Split_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_split_title = /** @type {((inputs?: Landing_Walk_Split_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Split_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_split_title(inputs)
	return ko_landing_walk_split_title(inputs)
});
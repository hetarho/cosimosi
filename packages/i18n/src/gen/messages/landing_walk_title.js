/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_TitleInputs */

const en_landing_walk_title = /** @type {(inputs: Landing_Walk_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Here is one diary, start to finish`)
};

const ko_landing_walk_title = /** @type {(inputs: Landing_Walk_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 편의 일기로 보여드릴게요`)
};

/**
* | output |
* | --- |
* | "Here is one diary, start to finish" |
*
* @param {Landing_Walk_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_title = /** @type {((inputs?: Landing_Walk_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_title(inputs)
	return ko_landing_walk_title(inputs)
});
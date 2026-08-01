/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Mirror_TitleInputs */

const en_landing_walk_mirror_title = /** @type {(inputs: Landing_Walk_Mirror_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The more you return, the more the sky leans that way`)
};

const ko_landing_walk_mirror_title = /** @type {(inputs: Landing_Walk_Mirror_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`자주 떠올릴수록, 하늘이 그쪽으로 기울어요`)
};

/**
* | output |
* | --- |
* | "The more you return, the more the sky leans that way" |
*
* @param {Landing_Walk_Mirror_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_mirror_title = /** @type {((inputs?: Landing_Walk_Mirror_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Mirror_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_mirror_title(inputs)
	return ko_landing_walk_mirror_title(inputs)
});
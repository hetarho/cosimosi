/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Mirror_ResultInputs */

const en_landing_walk_mirror_result = /** @type {(inputs: Landing_Walk_Mirror_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That feeling holds more of the sky now. Even after a hard stretch, what you keep returning to is what shows.`)
};

const ko_landing_walk_mirror_result = /** @type {(inputs: Landing_Walk_Mirror_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 감정의 자리가 넓어졌어요. 힘든 날이 많았더라도, 자주 돌아보는 마음이 하늘에 남아요.`)
};

/**
* | output |
* | --- |
* | "That feeling holds more of the sky now. Even after a hard stretch, what you keep returning to is what shows." |
*
* @param {Landing_Walk_Mirror_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_mirror_result = /** @type {((inputs?: Landing_Walk_Mirror_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Mirror_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_mirror_result(inputs)
	return ko_landing_walk_mirror_result(inputs)
});
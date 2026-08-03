/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Launch_ResultInputs */

const en_landing_walk_launch_result = /** @type {(inputs: Landing_Walk_Launch_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`There they are. The colour came from the feeling, the shape came from the words — no two days make the same star.`)
};

const ko_landing_walk_launch_result = /** @type {(inputs: Landing_Walk_Launch_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별이 됐어요. 색은 그때의 감정에서, 모양은 문장에서 왔어요. 같은 하루라도 똑같은 별은 없어요.`)
};

/**
* | output |
* | --- |
* | "There they are. The colour came from the feeling, the shape came from the words — no two days make the same star." |
*
* @param {Landing_Walk_Launch_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_launch_result = /** @type {((inputs?: Landing_Walk_Launch_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Launch_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_launch_result(inputs)
	return ko_landing_walk_launch_result(inputs)
});
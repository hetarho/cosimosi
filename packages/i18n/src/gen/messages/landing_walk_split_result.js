/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Split_ResultInputs */

const en_landing_walk_split_result = /** @type {(inputs: Landing_Walk_Split_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Three scenes came out — each with a name, the feeling it carried, and the neurons that will hold it.`)
};

const ko_landing_walk_split_result = /** @type {(inputs: Landing_Walk_Split_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`세 개의 장면이 나왔어요. 장면마다 이름과 그때의 감정, 장면을 붙잡아 줄 뉴런까지 함께 담겨요.`)
};

/**
* | output |
* | --- |
* | "Three scenes came out — each with a name, the feeling it carried, and the neurons that will hold it." |
*
* @param {Landing_Walk_Split_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_split_result = /** @type {((inputs?: Landing_Walk_Split_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Split_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_split_result(inputs)
	return ko_landing_walk_split_result(inputs)
});
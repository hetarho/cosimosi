/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Blog_BodyInputs */

const en_landing_blog_body = /** @type {(inputs: Landing_Blog_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`For anyone who wants the papers behind those five ideas, and what we did and did not take from them.`)
};

const ko_landing_blog_body = /** @type {(inputs: Landing_Blog_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다섯 가지 생각이 어디에서 왔는지, 거기서 무엇을 가져오고 무엇을 덜어냈는지 적어 뒀어요.`)
};

/**
* | output |
* | --- |
* | "For anyone who wants the papers behind those five ideas, and what we did and did not take from them." |
*
* @param {Landing_Blog_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_blog_body = /** @type {((inputs?: Landing_Blog_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Blog_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_blog_body(inputs)
	return ko_landing_blog_body(inputs)
});
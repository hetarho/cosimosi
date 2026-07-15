/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Gist_View_TitleInputs */

const en_gist_view_title = /** @type {(inputs: Gist_View_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The gist`)
};

const ko_gist_view_title = /** @type {(inputs: Gist_View_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지 보기`)
};

/**
* | output |
* | --- |
* | "The gist" |
*
* @param {Gist_View_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const gist_view_title = /** @type {((inputs?: Gist_View_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Gist_View_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_gist_view_title(inputs)
	return ko_gist_view_title(inputs)
});
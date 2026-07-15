/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Gist_View_ErrorInputs */

const en_gist_view_error = /** @type {(inputs: Gist_View_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Couldn't open the gist.`)
};

const ko_gist_view_error = /** @type {(inputs: Gist_View_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지를 열지 못했어요.`)
};

/**
* | output |
* | --- |
* | "Couldn't open the gist." |
*
* @param {Gist_View_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const gist_view_error = /** @type {((inputs?: Gist_View_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Gist_View_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_gist_view_error(inputs)
	return ko_gist_view_error(inputs)
});
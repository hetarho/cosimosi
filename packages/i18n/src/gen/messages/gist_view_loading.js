/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Gist_View_LoadingInputs */

const en_gist_view_loading = /** @type {(inputs: Gist_View_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Opening the gist…`)
};

const ko_gist_view_loading = /** @type {(inputs: Gist_View_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지를 여는 중…`)
};

/**
* | output |
* | --- |
* | "Opening the gist…" |
*
* @param {Gist_View_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const gist_view_loading = /** @type {((inputs?: Gist_View_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Gist_View_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_gist_view_loading(inputs)
	return ko_gist_view_loading(inputs)
});
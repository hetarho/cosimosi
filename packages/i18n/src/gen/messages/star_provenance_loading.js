/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_LoadingInputs */

const en_star_provenance_loading = /** @type {(inputs: Star_Provenance_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading…`)
};

const ko_star_provenance_loading = /** @type {(inputs: Star_Provenance_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불러오는 중…`)
};

/**
* | output |
* | --- |
* | "Loading…" |
*
* @param {Star_Provenance_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_loading = /** @type {((inputs?: Star_Provenance_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_loading(inputs)
	return ko_star_provenance_loading(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_View_PinnedInputs */

const en_universe_view_pinned = /** @type {(inputs: Universe_View_PinnedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fixed view`)
};

const ko_universe_view_pinned = /** @type {(inputs: Universe_View_PinnedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고정 모드`)
};

/**
* | output |
* | --- |
* | "Fixed view" |
*
* @param {Universe_View_PinnedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_view_pinned = /** @type {((inputs?: Universe_View_PinnedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_View_PinnedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_view_pinned(inputs)
	return ko_universe_view_pinned(inputs)
});
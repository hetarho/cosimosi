/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_View_Free_HintInputs */

const en_universe_view_free_hint = /** @type {(inputs: Universe_View_Free_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Turns the universe any way you like.`)
};

const ko_universe_view_free_hint = /** @type {(inputs: Universe_View_Free_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`어느 방향으로든 우주를 돌려서 봐요.`)
};

/**
* | output |
* | --- |
* | "Turns the universe any way you like." |
*
* @param {Universe_View_Free_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_view_free_hint = /** @type {((inputs?: Universe_View_Free_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_View_Free_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_view_free_hint(inputs)
	return ko_universe_view_free_hint(inputs)
});
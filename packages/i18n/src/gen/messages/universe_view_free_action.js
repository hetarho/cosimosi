/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_View_Free_ActionInputs */

const en_universe_view_free_action = /** @type {(inputs: Universe_View_Free_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Switch to the free view`)
};

const ko_universe_view_free_action = /** @type {(inputs: Universe_View_Free_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`자유 모드로 보기`)
};

/**
* | output |
* | --- |
* | "Switch to the free view" |
*
* @param {Universe_View_Free_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_view_free_action = /** @type {((inputs?: Universe_View_Free_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_View_Free_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_view_free_action(inputs)
	return ko_universe_view_free_action(inputs)
});
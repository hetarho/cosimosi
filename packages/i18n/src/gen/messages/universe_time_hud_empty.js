/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Time_Hud_EmptyInputs */

const en_universe_time_hud_empty = /** @type {(inputs: Universe_Time_Hud_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Begins with your first diary`)
};

const ko_universe_time_hud_empty = /** @type {(inputs: Universe_Time_Hud_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첫 일기와 함께 흐르기 시작해요`)
};

/**
* | output |
* | --- |
* | "Begins with your first diary" |
*
* @param {Universe_Time_Hud_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_time_hud_empty = /** @type {((inputs?: Universe_Time_Hud_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Time_Hud_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_time_hud_empty(inputs)
	return ko_universe_time_hud_empty(inputs)
});
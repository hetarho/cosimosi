/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Wide_StreakInputs */

const en_store_ornament_mote_wide_streak = /** @type {(inputs: Store_Ornament_Mote_Wide_StreakInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Wide Streak`)
};

const ko_store_ornament_mote_wide_streak = /** @type {(inputs: Store_Ornament_Mote_Wide_StreakInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`옆으로 늘어난 빛`)
};

/**
* | output |
* | --- |
* | "Wide Streak" |
*
* @param {Store_Ornament_Mote_Wide_StreakInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_wide_streak = /** @type {((inputs?: Store_Ornament_Mote_Wide_StreakInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Wide_StreakInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_wide_streak(inputs)
	return ko_store_ornament_mote_wide_streak(inputs)
});